const XLSX = require('xlsx');
const path = require('path');

const projects = [
  { 'Project ID': 'PRJ-001', 'Project Name': 'Website Redesign', 'Owner': 'Alice Johnson', 'Department': 'Engineering', 'Status': 'In Progress', 'Start Date': '2025-01-15', 'End Date': '2026-04-30', 'Budget': 150000, 'Actual Cost': 95000, '% Complete': 72, 'Priority': 'High', 'Notes': 'New branding rollout on track' },
  { 'Project ID': 'PRJ-002', 'Project Name': 'Mobile App v2', 'Owner': 'Bob Smith', 'Department': 'Engineering', 'Status': 'At Risk', 'Start Date': '2025-06-01', 'End Date': '2026-03-15', 'Budget': 300000, 'Actual Cost': 280000, '% Complete': 45, 'Priority': 'High', 'Notes': 'Scope creep causing delays' },
  { 'Project ID': 'PRJ-003', 'Project Name': 'CRM Migration', 'Owner': 'Carol Davis', 'Department': 'IT', 'Status': 'Blocked', 'Start Date': '2025-09-01', 'End Date': '2026-02-28', 'Budget': 200000, 'Actual Cost': 180000, '% Complete': 30, 'Priority': 'High', 'Notes': 'Waiting on vendor API access' },
  { 'Project ID': 'PRJ-004', 'Project Name': 'Data Warehouse Upgrade', 'Owner': 'Dave Wilson', 'Department': 'IT', 'Status': 'On Track', 'Start Date': '2025-11-01', 'End Date': '2026-06-30', 'Budget': 500000, 'Actual Cost': 150000, '% Complete': 40, 'Priority': 'Medium', 'Notes': 'Phase 1 complete' },
  { 'Project ID': 'PRJ-005', 'Project Name': 'Employee Portal', 'Owner': 'Eve Martin', 'Department': 'HR', 'Status': 'In Progress', 'Start Date': '2025-08-15', 'End Date': '2026-05-15', 'Budget': 120000, 'Actual Cost': 60000, '% Complete': 55, 'Priority': 'Medium', 'Notes': 'User testing started' },
  { 'Project ID': 'PRJ-006', 'Project Name': 'Security Audit', 'Owner': 'Frank Brown', 'Department': 'Security', 'Status': 'Complete', 'Start Date': '2025-10-01', 'End Date': '2026-01-31', 'Budget': 80000, 'Actual Cost': 75000, '% Complete': 100, 'Priority': 'High', 'Notes': 'All findings remediated' },
  { 'Project ID': 'PRJ-007', 'Project Name': 'Marketing Automation', 'Owner': 'Grace Lee', 'Department': 'Marketing', 'Status': 'Delayed', 'Start Date': '2025-07-01', 'End Date': '2026-03-01', 'Budget': 90000, 'Actual Cost': 85000, '% Complete': 60, 'Priority': 'Medium', 'Notes': 'Integration issues with email platform' },
  { 'Project ID': 'PRJ-008', 'Project Name': 'Cloud Migration Phase 3', 'Owner': 'Henry Clark', 'Department': 'IT', 'Status': 'In Progress', 'Start Date': '2026-01-01', 'End Date': '2026-09-30', 'Budget': 750000, 'Actual Cost': 120000, '% Complete': 15, 'Priority': 'High', 'Notes': 'AWS infrastructure provisioning underway' },
  { 'Project ID': 'PRJ-009', 'Project Name': 'Customer Feedback System', 'Owner': 'Ivy Rodriguez', 'Department': 'Product', 'Status': 'In Review', 'Start Date': '2025-12-01', 'End Date': '2026-04-15', 'Budget': 60000, 'Actual Cost': 45000, '% Complete': 80, 'Priority': 'Low', 'Notes': 'Final QA review in progress' },
  { 'Project ID': 'PRJ-010', 'Project Name': 'AI Chatbot Integration', 'Owner': 'Jack Thompson', 'Department': 'Engineering', 'Status': 'Active', 'Start Date': '2026-02-01', 'End Date': '2026-08-31', 'Budget': 250000, 'Actual Cost': 30000, '% Complete': 10, 'Priority': 'High', 'Notes': 'POC completed, starting implementation' },
  { 'Project ID': 'PRJ-011', 'Project Name': 'Office Relocation', 'Owner': 'Karen White', 'Department': 'Operations', 'Status': 'On Hold', 'Start Date': '2025-11-15', 'End Date': '2026-03-20', 'Budget': 400000, 'Actual Cost': 50000, '% Complete': 15, 'Priority': 'Low', 'Notes': 'Paused due to budget review' },
  { 'Project ID': 'PRJ-012', 'Project Name': 'Compliance Training Platform', 'Owner': 'Leo Garcia', 'Department': 'HR', 'Status': 'In Progress', 'Start Date': '2025-10-15', 'End Date': '2026-04-01', 'Budget': 70000, 'Actual Cost': 55000, '% Complete': 75, 'Priority': 'Medium', 'Notes': 'Content development 90% done' },
];

// Sheet 1 with standard column names
const wb = XLSX.utils.book_new();
const ws1 = XLSX.utils.json_to_sheet(projects);
XLSX.utils.book_append_sheet(wb, ws1, 'All Projects');

// Sheet 2 with slightly different column names (testing fuzzy match)
const sheet2Data = [
  { 'Proj ID': 'PRJ-013', 'Name': 'Supply Chain Optimization', 'PM': 'Mike Nelson', 'Team': 'Operations', 'State': 'Active', 'Begin Date': '2026-01-15', 'Deadline': '2026-07-31', 'Total Budget': 350000, 'Cost to Date': 80000, 'Progress': 20, 'Urgency': 'High', 'Remarks': 'Vendor negotiations ongoing' },
  { 'Proj ID': 'PRJ-014', 'Name': 'Payment Gateway v3', 'PM': 'Nancy Adams', 'Team': 'Engineering', 'State': 'In Progress', 'Begin Date': '2025-12-01', 'Deadline': '2026-05-31', 'Total Budget': 200000, 'Cost to Date': 110000, 'Progress': 50, 'Urgency': 'High', 'Remarks': 'PCI compliance testing next month' },
  { 'Proj ID': 'PRJ-015', 'Name': 'Brand Style Guide', 'PM': 'Olivia Perez', 'Team': 'Marketing', 'State': 'Done', 'Begin Date': '2025-09-01', 'Deadline': '2026-01-15', 'Total Budget': 25000, 'Cost to Date': 22000, 'Progress': 100, 'Urgency': 'Low', 'Remarks': 'Distributed to all teams' },
];
const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
XLSX.utils.book_append_sheet(wb, ws2, 'Portfolio Tracker');

const outPath = path.join(__dirname, '../data/sample_projects.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`Sample data written to ${outPath} (${projects.length + sheet2Data.length} projects across 2 sheets)`);
