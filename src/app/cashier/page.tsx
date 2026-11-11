"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  getCashierDashboard,
  getCashierClassrooms,
  searchCashierStudentsGlobally,
  approveCashierStudentFee,
  revertCashierStudentFee,
  approveCashierBulkFees,
  CashierDashboardStats,
  CashierClassroom,
  CashierGlobalStudentFeeRow,
} from "@/lib/cashier-api";
import { ApiError } from "@/lib/api";
import {
  School,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Wallet,
  ShieldCheck,
  ChevronRight,
  Zap,
  Search,
  Check,
  RotateCcw,
} from "lucide-react";
import { PageHeader, StatCard, Card, Button, Badge, LinkButton } from "@/components/ui/controls";
import { PageLoader, ErrorState, ButtonSpinner, TableSkeleton } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";

export default function CashierDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CashierDashboardStats | null>(null);
  const [classes, setClasses] = useState<CashierClassroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Quick Student Fee Clearance Widget State ──
  const [quickQuery, setQuickQuery] = useState("");
  const [quickResults, setQuickResults] = useState<CashierGlobalStudentFeeRow[]>([]);
  const [searchingQuick, setSearchingQuick] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Recent Clearances (Undo Support) State ──
  const [recentClearances, setRecentClearances] = useState<
    { student: CashierGlobalStudentFeeRow; timestamp: number }[]
  >([]);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  // Load recent clearances from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cashier_recent_clearances");
      if (stored) {
        setRecentClearances(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const saveRecentClearance = (student: CashierGlobalStudentFeeRow) => {
    setRecentClearances((prev) => {
      const filtered = prev.filter((item) => item.student.id !== student.id);
      const updated = [{ student, timestamp: Date.now() }, ...filtered].slice(0, 8);
      try {
        localStorage.setItem("cashier_recent_clearances", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleRevertFee = async (item: { student: CashierGlobalStudentFeeRow }) => {
    setRevertingId(item.student.id);
    try {
      await revertCashierStudentFee(item.student.id);
      setNotice(`Fee approval reverted for ${item.student.studentName} (${item.student.registerNumber}).`);
      setTimeout(() => setNotice(null), 5000);
      setRecentClearances((prev) => {
        const updated = prev.filter((r) => r.student.id !== item.student.id);
        try {
          localStorage.setItem("cashier_recent_clearances", JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setQuickResults((prev) =>
        prev.map((s) => (s.id === item.student.id ? { ...s, verified: false, cashierApproved: false } : s))
      );
      load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Failed to revert fee approval.");
    } finally {
      setRevertingId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, classesData] = await Promise.all([
        getCashierDashboard(),
        getCashierClassrooms({ page: 1, limit: 6 }),
      ]);
      setStats(statsData);
      setClasses(classesData.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Quick search effect
  useEffect(() => {
    const q = quickQuery.trim();
    if (!q) {
      setQuickResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingQuick(true);
      try {
        const res = await searchCashierStudentsGlobally(q);
        setQuickResults(res);
      } catch {
        setQuickResults([]);
      } finally {
        setSearchingQuick(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [quickQuery]);

  const handleQuickApprove = async (student: CashierGlobalStudentFeeRow) => {
    setApprovingId(student.id);
    try {
      await approveCashierStudentFee(student.id);
      setNotice(`Fee approved successfully for ${student.studentName} (${student.registerNumber}).`);
      setTimeout(() => setNotice(null), 5000);
      saveRecentClearance(student);
      setQuickResults((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, verified: true, cashierApproved: true } : s))
      );
      load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Failed to approve fee.");
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) return <PageLoader label="Loading cashier dashboard…" />;

  if (error || !stats) {
    return (
      <div>
        <PageHeader breadcrumb="Cashier / Dashboard" title="Dashboard" description="Fee clearance overview" />
        <Card>
          <ErrorState message={error ?? "Failed to load cashier dashboard"} onRetry={load} />
        </Card>
      </div>
    );
  }

  const verifiedPercent =
    stats.totalStudents > 0 ? Math.round((stats.verifiedFees / stats.totalStudents) * 100) : 0;

  return (
    <div>
      <PageHeader
        breadcrumb="Cashier / Dashboard"
        title={`Welcome, ${user ? `${user.firstName} ${user.lastName}` : "Dinesh Prabhu Y"}`}
        description="Institutional fee verification overview across all departments and classrooms."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={load}>
              <RefreshCw style={{ width: 14, height: 14 }} />
              Refresh
            </Button>
            <LinkButton href="/cashier/classrooms">
              <School style={{ width: 14, height: 14 }} />
              Manage All Classes
            </LinkButton>
          </div>
        }
      />

      {notice && (
        <div className="nd-alert nd-alert-success" role="status" style={{ marginBottom: 16 }}>
          <Check style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{notice}</span>
        </div>
      )}

      {/* ─── QUICK STUDENT CLEARANCE WIDGET ─── */}
      <div className="nd-card" style={{ marginBottom: 20, padding: 20, background: "linear-gradient(to right, #eff6ff, #f8fafc)", border: "1px solid #bfdbfe" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <Zap style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e3a8a" }}>Quick Counter Fee Clearance</h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>Enter Student Roll No or Register No for instant one-click fee approval</p>
          </div>
        </div>

        <div style={{ position: "relative", maxWidth: 600 }}>
          <div className="nd-search-wrap" style={{ width: "100%" }}>
            <Search className="nd-search-icon" style={{ width: 18, height: 18 }} />
            <input
              className="nd-input nd-search-input"
              placeholder="Type Register No (e.g. 732923AMR037) or Roll No…"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              style={{ fontSize: 14, padding: "10px 14px 10px 38px", background: "#fff", borderColor: "#93c5fd" }}
              aria-label="Quick counter fee clearance"
            />
          </div>
        </div>

        {/* Quick Results Card */}
        {quickQuery.trim() && (
          <div style={{ marginTop: 14 }}>
            {searchingQuick ? (
              <TableSkeleton rows={2} cols={4} />
            ) : quickResults.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {quickResults.map((st) => (
                  <div
                    key={st.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span className="nd-code" style={{ fontWeight: 700, color: "#1e40af", fontSize: 13 }}>
                          {st.registerNumber}
                        </span>
                        {st.verified ? (
                          <Badge tone="success">Fee Verified</Badge>
                        ) : (
                          <Badge tone="warning">Pending</Badge>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{st.studentName}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        Roll No: <strong>{st.rollNumber || "N/A"}</strong> · {st.department?.code} ({st.classroom?.name || "Class"})
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      {st.verified ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#16a34a", fontSize: 13, fontWeight: 500 }}>
                          <CheckCircle2 style={{ width: 16, height: 16 }} />
                          Cleared
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleQuickApprove(st)}
                          disabled={approvingId === st.id}
                        >
                          {approvingId === st.id && <ButtonSpinner />}
                          <Check style={{ width: 14, height: 14 }} />
                          Approve Fee Now
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, fontSize: 13, color: "#64748b", border: "1px solid #e2e8f0" }}>
                No student found matching &quot;{quickQuery}&quot;.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge tone="success">Cashier Authority Active</Badge>
        <Badge tone={stats.pendingFees > 0 ? "warning" : "success"}>
          {stats.pendingFees > 0 ? `${stats.pendingFees} Students Pending Verification` : "All Fees Cleared"}
        </Badge>
        <Badge tone="info">{stats.totalDepartments} Academic Departments</Badge>
      </div>

      {/* ─── METRIC CARDS ─── */}
      <div className="nd-stat-grid">
        <StatCard
          label="Total Classes"
          value={stats.totalClassrooms}
          sub={`${stats.totalDepartments} departments college-wide`}
          icon={<School style={{ width: 18, height: 18 }} />}
        />
        <StatCard
          label="Total Students"
          value={stats.totalStudents.toLocaleString()}
          sub="Enrolled active students"
          icon={<Users style={{ width: 18, height: 18 }} />}
        />
        <StatCard
          label="Fee Clearance Rate"
          value={`${verifiedPercent}%`}
          sub={`${stats.verifiedFees} of ${stats.totalStudents} students verified`}
          icon={<CheckCircle2 style={{ width: 18, height: 18, color: "var(--nd-success, #16a34a)" }} />}
        />
        <StatCard
          label="Pending Verification"
          value={stats.pendingFees.toLocaleString()}
          sub={stats.pendingFees > 0 ? "Awaiting cashier / fee clearance" : "All cleared"}
          icon={<Clock style={{ width: 18, height: 18, color: stats.pendingFees > 0 ? "var(--nd-warning, #d97706)" : undefined }} />}
        />
      </div>

      {/* ─── TWO COLUMN OPERATIONS & CLASSROOM SHORTCUTS ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }} className="nd-two-col">
        {/* Left Column: Quick Actions & Role Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Quick Actions" description="Fast fee management shortcuts.">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              <Link
                href="/cashier/classrooms"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 14px",
                  border: "1px solid var(--nd-border, #e2e8f0)",
                  borderRadius: 10,
                  textDecoration: "none",
                  background: "#fff",
                  transition: "background 0.15s ease",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="nd-stat-icon" style={{ width: 34, height: 34 }}>
                    <School style={{ width: 16, height: 16 }} />
                  </span>
                  <span>
                    <div className="nd-cell-primary" style={{ fontWeight: 600 }}>All Classes Directory</div>
                    <div className="nd-cell-secondary" style={{ fontSize: 12 }}>Filter and review class rosters</div>
                  </span>
                </span>
                <ChevronRight style={{ width: 16, height: 16, color: "var(--nd-muted)" }} />
              </Link>
            </div>
          </Card>

          <Card title="Cashier Authorization" description="Scope & approval rules.">
            <div style={{ fontSize: 13, color: "var(--nd-muted)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <ShieldCheck style={{ width: 16, height: 16, color: "var(--nd-blue)", flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>College-wide Authority:</strong> You can approve student fee clearances across <em>all departments and batches</em>.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <CheckCircle2 style={{ width: 16, height: 16, color: "var(--nd-success)", flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>Instant Clearance:</strong> When you approve a student&apos;s fee, their No-Due fee verification is instantly marked <strong>Verified</strong>.
                </span>
              </div>
            </div>
          </Card>

          {/* ─── FEATURE 4: RECENT CLEARANCES & ONE-CLICK UNDO ─── */}
          <Card
            title="Recent Clearances"
            description="Last approved students with one-click undo option."
            actions={
              recentClearances.length > 0 && (
                <button
                  onClick={() => {
                    setRecentClearances([]);
                    try {
                      localStorage.removeItem("cashier_recent_clearances");
                    } catch {}
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--nd-text-secondary, #64748b)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Clear History
                </button>
              )
            }
          >
            {recentClearances.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--nd-text-secondary, #64748b)", padding: "12px 0" }}>
                No recent fee approvals in this session yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {recentClearances.map((item) => (
                  <div
                    key={item.student.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--nd-border, #e2e8f0)",
                      background: "#fff",
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.student.studentName}</div>
                      <div style={{ fontSize: 11, color: "var(--nd-text-secondary, #64748b)" }}>
                        {item.student.registerNumber} · {item.student.classroom?.name}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRevertFee(item)}
                      disabled={revertingId === item.student.id}
                      style={{ fontSize: 12, padding: "4px 8px", height: "auto" }}
                      title="Undo fee approval"
                    >
                      {revertingId === item.student.id ? (
                        <ButtonSpinner />
                      ) : (
                        <RotateCcw style={{ width: 12, height: 12 }} />
                      )}
                      Undo
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Classroom Fee Roster Highlights */}
        <Card
          title="Classrooms Requiring Clearance"
          description="Recent classrooms across departments and their current fee verification progress."
          actions={
            <LinkButton href="/cashier/classrooms" variant="ghost" size="sm">
              View All Classes <ArrowRight style={{ width: 14, height: 14 }} />
            </LinkButton>
          }
        >
          {classes.length === 0 ? (
            <p className="nd-cell-secondary" style={{ padding: "16px 0" }}>No classrooms found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {classes.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--nd-border, #e2e8f0)",
                    background: "#fafafa",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                      <Badge tone="info">{c.department.code}</Badge>
                    </div>
                    <div className="nd-cell-secondary" style={{ fontSize: 12, marginTop: 2 }}>
                      Sem {c.semester} (Sec {c.section}) · Batch {c.batch} · {c.totalStudents} Students
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      {c.pendingCount === 0 ? (
                        <Badge tone="success">All Cleared ({c.verifiedCount})</Badge>
                      ) : (
                        <Badge tone="warning">{c.pendingCount} Pending</Badge>
                      )}
                    </div>
                    <Link
                      href="/cashier/classrooms"
                      className="nd-btn nd-btn-secondary nd-btn-sm"
                      style={{ textDecoration: "none" }}
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
