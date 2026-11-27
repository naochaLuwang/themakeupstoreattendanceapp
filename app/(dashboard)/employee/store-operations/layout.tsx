import EmployeeStoreOpsNav from '@/components/employee/EmployeeStoreOpsNav';
import './operations.css';

export default function StoreOperationsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="employee-operations employee-ops-workspace">
            <EmployeeStoreOpsNav />
            <div className="employee-ops-content">{children}</div>
        </div>
    );
}
