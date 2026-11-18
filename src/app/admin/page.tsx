"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getDashboardStats, downloadMasterClearanceSummary, downloadMasterDefaulters, DashboardStats } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { Building2, UserCheck, Users, PieChart, RefreshCw, Download, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Card, Button } from "@/components/ui/controls";
import { PageLoader, ErrorState, ActivityList, ButtonSpinner } from "@/components/ui/feedback";
import { humanizeActivity } from "@/lib/activity";

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingSummary, setDownloadingSummary] = useState(false);
  const [downloadingDefaulters, setDownloadingDefaulters] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportSummary = async () => {
    setDownloadingSummary(true);
    try {
      const blob = await downloadMasterClearanceSummary();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `college-master-clearance-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export clearance summary report.");
    } finally {
      setDownloadingSummary(false);
    }
  };

  const handleExportDefaulters = async () => {
    setDownloadingDefaulters(true);
    try {
      const blob = await downloadMasterDefaulters();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `college-defaulters-list-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export defaulters report.");
    } finally {
      setDownloadingDefaulters(false);
    }
  };

  if (loading) return <PageLoader label="Loading dashboard…" />;
  if (error || !stats) {
    return (
      <div>
        <PageHeader breadcrumb="Admin / Dashboard" title="Dashboard" description="System-wide overview" />
        <Card>
          <ErrorState message={error ?? "Failed to load dashboard"} onRetry={load} />
        </Card>
      </div>
    );
  }

  const coverage =
    stats.totalDepartments > 0
      ? Math.round((stats.departmentsWithHod / stats.totalDepartments) * 100)
      : 0;

  const activities = stats.recentActivities.map((log) => humanizeActivity(log));

  return (
    <div>
      <PageHeader
        breadcrumb="Admin / Dashboard"
        title="Dashboard"
        description="System-wide overview of departments, people, and HOD coverage."
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              onClick={handleExportSummary}
              disabled={downloadingSummary}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {downloadingSummary ? <ButtonSpinner /> : <FileSpreadsheet style={{ width: 14, height: 14 }} />}
              Master Clearance Register
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportDefaulters}
              disabled={downloadingDefaulters}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {downloadingDefaulters ? <ButtonSpinner /> : <AlertTriangle style={{ width: 14, height: 14, color: "#d97706" }} />}
              College Defaulters List
            </Button>
            <Button variant="secondary" onClick={load}>
              <RefreshCw style={{ width: 14, height: 14 }} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="nd-stat-grid">
        <StatCard
          label="Total Departments"
          value={stats.totalDepartments}
          sub={`${stats.departmentsWithHod} with HOD assigned`}
          icon={<Building2 style={{ width: 17, height: 17 }} />}
        />
        <StatCard
          label="HOD Coverage"
          value={`${coverage}%`}
          sub={
            stats.departmentsWithoutHod > 0
              ? `${stats.departmentsWithoutHod} department${stats.departmentsWithoutHod !== 1 ? "s" : ""} need an HOD`
              : "Every department has an HOD"
          }
          icon={<PieChart style={{ width: 17, height: 17 }} />}
        />
        <StatCard
          label="Total Users"
          value={stats.totalUsers.toLocaleString()}
          sub={`${stats.activeUsers.toLocaleString()} active`}
          icon={<Users style={{ width: 17, height: 17 }} />}
        />
        <StatCard
          label="Active Users"
          value={stats.activeUsers.toLocaleString()}
          sub={`${stats.inactiveUsers.toLocaleString()} inactive`}
          icon={<UserCheck style={{ width: 17, height: 17 }} />}
        />
      </div>

      <Card title="Recent activity" description="Latest administrative and sign-in events across the system.">
        <ActivityList items={activities} emptyText="No recent activity." />
      </Card>
    </div>
  );
}
