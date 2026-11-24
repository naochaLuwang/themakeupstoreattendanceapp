import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
function handler({result={success:true,state:'completed',data:{id:'saved'}},throws=false}={}){
    const calls=[];const context=vm.createContext({crypto:{randomUUID},Date,Number,Error,URL});
    function compile(file,imports){const compiledModule={exports:{}};const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const factory=vm.runInContext(`(function(require,module,exports){${source}\n})`,context);factory(name=>imports[name],compiledModule,compiledModule.exports);return compiledModule.exports;}
    const engine=compile('lib/attendance/engine.ts',{});
    const origin=compile('lib/attendance/origin.ts',{});
    const http=compile('lib/attendance/http.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,...options})}},'./engine':engine,'./origin':origin,'./server':{performAttendance:async(...args)=>{calls.push(args);if(throws)throw new Error('internal transport failure');return result;}}});
    return {...http,calls};
}
const employee='00000000-0000-4000-8000-000000000001';
const session='20000000-0000-4000-8000-000000000001';
function request(body,{origin='https://attendance.test',type='application/json'}={}){
    return {url:'https://attendance.test/api/attendance/clock-out',headers:new Headers({'content-type':type,origin}),json:async()=>body};
}
test('cross-origin and form attendance submissions never reach the engine',async()=>{
    const http=handler();
    assert.equal((await http.attendancePost(request({userId:employee},{origin:'https://attacker.test'}),'clock_out')).status,403);
    assert.equal((await http.attendancePost(request({userId:employee},{type:'text/plain'}),'clock_out')).status,415);
    assert.equal(http.calls.length,0);
});
test('HTTP preserves the exact session, version and idempotency key without retry',async()=>{
    const http=handler();const operationId=randomUUID();
    const response=await http.attendancePost(request({userId:employee,attendanceId:session,expectedVersion:4,operationId}),'clock_out');
    assert.equal(response.status,200);assert.equal(response.headers['Cache-Control'],'no-store');
    assert.equal(http.calls.length,1);assert.equal(http.calls[0][0].attendanceId,session);assert.equal(http.calls[0][0].expectedVersion,4);assert.equal(http.calls[0][1],operationId);
});
test('validation and ambiguous server failures never produce a successful attendance response',async()=>{
    const invalid=handler();assert.equal((await invalid.attendancePost(request({userId:'invalid'}),'clock_out')).status,400);assert.equal(invalid.calls.length,0);
    const down=handler({throws:true});const response=await down.attendancePost(request({userId:employee}),'clock_out');assert.equal(response.status,503);assert.equal(response.body.success,false);assert.equal(down.calls.length,1);
});
