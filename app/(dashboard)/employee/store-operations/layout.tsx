import EmployeeStoreOpsNav from '@/components/employee/EmployeeStoreOpsNav';

export default function StoreOperationsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="employee-operations space-y-6">
            <EmployeeStoreOpsNav />
            {children}
        </div>
    );
}
