import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color: "blue" | "green" | "yellow" | "red";
}

const colorClasses = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
  green: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
  yellow:
    "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400",
  red: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
};

export default function StatsCard({ title, value, icon, color }: StatsCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
        <div className={`rounded-full p-3 ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
