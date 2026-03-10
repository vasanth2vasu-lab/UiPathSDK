import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const RAG_COLORS = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e', unknown: '#9ca3af' };

export default function ChartsSection({ projects }) {
  if (!projects || projects.length === 0) return null;

  // Donut data
  const ragCounts = { red: 0, amber: 0, green: 0, unknown: 0 };
  projects.forEach(p => { ragCounts[p.rag_status] = (ragCounts[p.rag_status] || 0) + 1; });
  const donutData = Object.entries(ragCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, fill: RAG_COLORS[name] }));

  // By department
  const deptMap = {};
  projects.forEach(p => {
    const dept = p.department || 'Unknown';
    if (!deptMap[dept]) deptMap[dept] = { name: dept, red: 0, amber: 0, green: 0, unknown: 0 };
    deptMap[dept][p.rag_status]++;
  });
  const deptData = Object.values(deptMap).sort((a, b) => (b.red + b.amber + b.green) - (a.red + a.amber + a.green)).slice(0, 10);

  // By owner
  const ownerMap = {};
  projects.forEach(p => {
    const owner = p.owner || 'Unassigned';
    if (!ownerMap[owner]) ownerMap[owner] = { name: owner, red: 0, amber: 0, green: 0, unknown: 0 };
    ownerMap[owner][p.rag_status]++;
  });
  const ownerData = Object.values(ownerMap).sort((a, b) => (b.red + b.amber) - (a.red + a.amber)).slice(0, 10);

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* RAG Donut */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Projects by RAG Status</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={donutData} innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
              {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* By Department */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Projects by Department</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={deptData} layout="vertical">
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="red" stackId="a" fill={RAG_COLORS.red} name="Red" />
            <Bar dataKey="amber" stackId="a" fill={RAG_COLORS.amber} name="Amber" />
            <Bar dataKey="green" stackId="a" fill={RAG_COLORS.green} name="Green" />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By Owner */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Projects by Owner</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={ownerData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="red" stackId="a" fill={RAG_COLORS.red} name="Red" />
            <Bar dataKey="amber" stackId="a" fill={RAG_COLORS.amber} name="Amber" />
            <Bar dataKey="green" stackId="a" fill={RAG_COLORS.green} name="Green" />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
