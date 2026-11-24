import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const compiledModule={exports:{}};
const source=ts.transpileModule(readFileSync('lib/attendance/engine.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(`(function(module,exports){${source}\n})(compiledModule,compiledModule.exports)`,{compiledModule,crypto:{randomUUID},Date,Number,Error});
const {parseAttendanceRequest,transitionAttendance}=compiledModule.exports;
const employee='00000000-0000-4000-8000-000000000001';
const store='10000000-0000-4000-8000-000000000001';
const shift='20000000-0000-4000-8000-000000000001';
const session='30000000-0000-4000-8000-000000000001';
const body={userId:employee,storeId:store,shiftId:shift,lat:0,lng:0};
function client(result,{user=employee,authError=null,rpcError=null}={}){
    const calls=[];
    return {calls,auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:authError})},rpc:async(...args)=>{calls.push(args);return {data:result,error:rpcError};}};
}
const saved={id:session,check_in:'2026-11-24T04:30:00Z',check_out:null,version:1};
test('legacy request bodies remain accepted and retain zero coordinates',()=>{
    const parsed=parseAttendanceRequest(body,'clock_in');
    assert.equal(parsed.command.lat,0);assert.equal(parsed.command.lng,0);assert.equal(parsed.command.employeeId,employee);
    assert.match(parsed.operationId,/^[a-f0-9-]{36}$/);
    assert.equal(parseAttendanceRequest({userId:employee},'clock_out').command.attendanceId,undefined);
});
test('modern request metadata, operation IDs and expected session versions are retained',()=>{
    const key=randomUUID();const capturedAt='2026-11-24T04:30:00Z';
    const inside=parseAttendanceRequest({...body,accuracy:12,capturedAt,operationId:key,check_in:'1900-01-01',attendance_method:'qr'},'clock_in');
    assert.equal(inside.operationId,key);assert.equal(inside.command.capturedAt,capturedAt);
    assert.equal(inside.command.check_in,undefined);assert.equal(inside.command.attendance_method,undefined);
    const out=parseAttendanceRequest({userId:employee,attendanceId:session,expectedVersion:3,operationId:key},'clock_out');
    assert.equal(out.command.attendanceId,session);assert.equal(out.command.expectedVersion,3);
});
test('invalid coordinates, UUIDs, GPS metadata and session versions fail before mutation',()=>{
    for(const patch of [{lat:'0'},{lat:NaN},{lng:Infinity},{lat:91},{lng:-181},{userId:'x'},{storeId:null},{accuracy:10},{accuracy:-1,capturedAt:'2026-11-24'},{accuracy:10,capturedAt:'bad'}])assert.throws(()=>parseAttendanceRequest({...body,...patch},'clock_in'));
    for(const expectedVersion of [0,-1,1.2,'1',Infinity])assert.throws(()=>parseAttendanceRequest({userId:employee,expectedVersion},'clock_out'));
});
test('unauthenticated and cross-employee requests never enter the RPC',async()=>{
    for(const options of [{user:null},{user:store},{authError:{message:'expired'}}]){
        const db=client(null,options);const result=await transitionAttendance(db,{action:'clock_out',employeeId:employee});
        assert.equal(result.success,false);assert.equal(db.calls.length,0);
    }
});
test('the service uses one transaction RPC and forwards the caller operation ID unchanged',async()=>{
    const db=client({success:true,state:'clocked_in',changed:true,data:saved});const key=randomUUID();
    const result=await transitionAttendance(db,{action:'clock_in',employeeId:employee,storeId:store,shiftId:shift,lat:0,lng:0},key,'server_action');
    assert.equal(result.success,true);assert.equal(db.calls.length,1);assert.equal(db.calls[0][0],'attendance_transition');
    assert.equal(db.calls[0][1].p_operation_id,key);assert.equal(db.calls[0][1].p_entry_point,'server_action');
});
test('completed/stale/conflicting responses remain errors and are not retried',async()=>{
    const db=client({success:false,error:'ATTENDANCE_STALE: refresh before trying again',code:'23514'});
    const result=await transitionAttendance(db,{action:'clock_out',employeeId:employee});
    assert.equal(result.success,false);assert.equal(result.status,409);assert.equal(result.error,'refresh before trying again');assert.equal(db.calls.length,1);
});
test('a missing migration fails closed with an installation message',async()=>{
    const db=client(null,{rpcError:{code:'PGRST202',message:'Could not find attendance_transition'}});
    const result=await transitionAttendance(db,{action:'clock_out',employeeId:employee});
    assert.equal(result.status,503);assert.match(result.error,/migration 006/);assert.equal(db.calls.length,1);
});
test('malformed success responses never masquerade as confirmed attendance',async()=>{
    for(const value of [null,{},[],{success:true,state:'invented',data:saved},{success:true,state:'clocked_in',data:{id:session}}]){
        const result=await transitionAttendance(client(value),{action:'clock_out',employeeId:employee});assert.equal(result.success,false);
    }
});
