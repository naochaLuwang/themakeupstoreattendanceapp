import Link from 'next/link';
import EmployeeOperationIcon from '@/components/employee/EmployeeOperationIcon';
import { employeeOperationsModules, employeeOperationsRoot } from '@/lib/store-ops/employee-navigation';

export const metadata = { title: 'Store operations' };

export default function EmployeeStoreOperationsPage() {
    return <div className="ops-overview">
        <header className="ops-page-heading"><div><h1>Store operations</h1><p>Daily work and store reports</p></div></header>
        <div className="ops-module-cards">
            {employeeOperationsModules.map(module => <Link key={module.path} href={`${employeeOperationsRoot}/${module.path}`} className="ops-module-card">
                <span className="ops-module-icon"><EmployeeOperationIcon name={module.path} size={24} /></span>
                <div><h4>{module.label}</h4><p>{module.description}</p></div>
            </Link>)}
        </div>
    </div>;
}
