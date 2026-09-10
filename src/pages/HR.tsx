import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users, Clock, ScrollText, Wallet, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useSettings } from "@/contexts/SettingsContext";
import { toast } from "@/hooks/use-toast";
import {
  useEmployeesCloud, useAttendanceCloud, useWorkplaceRulesCloud, usePayrollCloud,
  type Employee, type AttendanceRecord, type WorkplaceRule, type PayrollEntry,
} from "@/hooks/useAppData";

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const emptyEmployee = (): Employee => ({
  id: crypto.randomUUID(), code: "", name: "", designation: "", department: "", phone: "",
  cnic: "", address: "", joinDate: today(), salary: 0, status: "active", notes: "",
});
const emptyAttendance = (): AttendanceRecord => ({
  id: crypto.randomUUID(), employeeId: "", employeeName: "", date: today(),
  checkIn: "09:00", checkOut: "18:00", status: "present", hours: 0, notes: "",
});
const emptyRule = (): WorkplaceRule => ({
  id: crypto.randomUUID(), title: "", category: "General", description: "", effectiveDate: today(), sortOrder: 0,
});
const emptyPayroll = (): PayrollEntry => ({
  id: crypto.randomUUID(), employeeId: "", employeeName: "", month: thisMonth(),
  basicSalary: 0, allowances: 0, overtime: 0, deductions: 0, advance: 0, netPay: 0,
  status: "pending", paidDate: "", paymentMethod: "Cash", notes: "",
});

const hoursBetween = (inT: string, outT: string) => {
  if (!inT || !outT) return 0;
  const [ih, im] = inT.split(":").map(Number);
  const [oh, om] = outT.split(":").map(Number);
  if ([ih, im, oh, om].some((n) => Number.isNaN(n))) return 0;
  const mins = oh * 60 + om - (ih * 60 + im);
  return Math.max(0, Math.round((mins / 60) * 100) / 100);
};

export default function HR() {
  const { formatCurrency, formatDate } = useSettings();
  const employees = useEmployeesCloud();
  const attendance = useAttendanceCloud();
  const rules = useWorkplaceRulesCloud();
  const payroll = usePayrollCloud();

  const [tab, setTab] = useState("employees");

  // ---------- Employees ----------
  const [empDialog, setEmpDialog] = useState(false);
  const [empForm, setEmpForm] = useState<Employee>(emptyEmployee);
  const [empSearch, setEmpSearch] = useState("");
  const [empStatus, setEmpStatus] = useState("all");

  const activeEmployees = useMemo(() => employees.data.filter((e) => e.status === "active"), [employees.data]);
  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return employees.data
      .filter((e) => (empStatus === "all" ? true : e.status === empStatus))
      .filter((e) => !q || [e.name, e.code, e.designation, e.department, e.phone].some((v) => (v || "").toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees.data, empSearch, empStatus]);

  const saveEmployee = async () => {
    if (!empForm.name.trim()) { toast({ title: "Employee name is required", variant: "destructive" }); return; }
    await employees.upsert({ ...empForm, name: empForm.name.trim() });
    setEmpDialog(false);
    toast({ title: "Employee saved" });
  };

  // ---------- Attendance ----------
  const [attDialog, setAttDialog] = useState(false);
  const [attForm, setAttForm] = useState<AttendanceRecord>(emptyAttendance);
  const [attDate, setAttDate] = useState("");
  const [attEmployee, setAttEmployee] = useState("all");

  const filteredAttendance = useMemo(() => {
    return attendance.data
      .filter((a) => (attDate ? a.date === attDate : true))
      .filter((a) => (attEmployee === "all" ? true : a.employeeId === attEmployee))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance.data, attDate, attEmployee]);

  const saveAttendance = async () => {
    if (!attForm.employeeId || !attForm.date) { toast({ title: "Select employee and date", variant: "destructive" }); return; }
    const emp = employees.data.find((e) => e.id === attForm.employeeId);
    const paid = attForm.status === "present" || attForm.status === "half-day";
    await attendance.upsert({
      ...attForm,
      employeeName: emp?.name || attForm.employeeName,
      hours: paid ? hoursBetween(attForm.checkIn, attForm.checkOut) : 0,
    });
    setAttDialog(false);
    toast({ title: "Attendance saved" });
  };

  // ---------- Rules ----------
  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState<WorkplaceRule>(emptyRule);
  const sortedRules = useMemo(
    () => [...rules.data].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [rules.data],
  );

  const saveRule = async () => {
    if (!ruleForm.title.trim()) { toast({ title: "Rule title is required", variant: "destructive" }); return; }
    await rules.upsert({ ...ruleForm, title: ruleForm.title.trim() });
    setRuleDialog(false);
    toast({ title: "Rule saved" });
  };

  // ---------- Payroll ----------
  const [payDialog, setPayDialog] = useState(false);
  const [payForm, setPayForm] = useState<PayrollEntry>(emptyPayroll);
  const [payMonth, setPayMonth] = useState("");

  const netOf = (p: PayrollEntry) =>
    (p.basicSalary || 0) + (p.allowances || 0) + (p.overtime || 0) - (p.deductions || 0) - (p.advance || 0);

  const filteredPayroll = useMemo(() => {
    return payroll.data
      .filter((p) => (payMonth ? p.month === payMonth : true))
      .sort((a, b) => b.month.localeCompare(a.month) || a.employeeName.localeCompare(b.employeeName));
  }, [payroll.data, payMonth]);

  const payrollTotals = useMemo(() => ({
    net: filteredPayroll.reduce((s, p) => s + netOf(p), 0),
    paid: filteredPayroll.filter((p) => p.status === "paid").reduce((s, p) => s + netOf(p), 0),
    pending: filteredPayroll.filter((p) => p.status !== "paid").reduce((s, p) => s + netOf(p), 0),
  }), [filteredPayroll]);

  const savePayroll = async () => {
    if (!payForm.employeeId || !payForm.month) { toast({ title: "Select employee and month", variant: "destructive" }); return; }
    const emp = employees.data.find((e) => e.id === payForm.employeeId);
    await payroll.upsert({
      ...payForm,
      employeeName: emp?.name || payForm.employeeName,
      netPay: netOf(payForm),
      paidDate: payForm.status === "paid" ? (payForm.paidDate || today()) : "",
    });
    setPayDialog(false);
    toast({ title: "Salary entry saved" });
  };

  const generatePayroll = async () => {
    const month = payMonth || thisMonth();
    const missing = activeEmployees.filter((e) => !payroll.data.some((p) => p.month === month && p.employeeId === e.id));
    if (missing.length === 0) { toast({ title: "Salary sheet already generated for this month" }); return; }
    for (const e of missing) {
      await payroll.upsert({
        ...emptyPayroll(), id: crypto.randomUUID(), employeeId: e.id, employeeName: e.name,
        month, basicSalary: e.salary, netPay: e.salary,
      });
    }
    setPayMonth(month);
    toast({ title: `Salary sheet generated for ${missing.length} employee(s)` });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      present: "bg-emerald-500/15 text-emerald-600",
      absent: "bg-destructive/15 text-destructive",
      leave: "bg-amber-500/15 text-amber-600",
      "half-day": "bg-blue-500/15 text-blue-600",
      holiday: "bg-muted text-muted-foreground",
      active: "bg-emerald-500/15 text-emerald-600",
      inactive: "bg-muted text-muted-foreground",
      paid: "bg-emerald-500/15 text-emerald-600",
      pending: "bg-amber-500/15 text-amber-600",
    };
    return <Badge className={`${map[s] || "bg-muted text-muted-foreground"} border-0 capitalize`}>{s}</Badge>;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Human Resources</h1>
          <p className="text-sm text-muted-foreground">Employees, attendance, workplace rules and payroll</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Employees</p><p className="text-2xl font-semibold">{employees.data.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active</p><p className="text-2xl font-semibold">{activeEmployees.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Present Today</p><p className="text-2xl font-semibold">{attendance.data.filter((a) => a.date === today() && a.status === "present").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Monthly Salary Budget</p><p className="text-2xl font-semibold">{formatCurrency(activeEmployees.reduce((s, e) => s + (e.salary || 0), 0))}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="employees"><Users className="mr-2 h-4 w-4" />Employees</TabsTrigger>
          <TabsTrigger value="attendance"><Clock className="mr-2 h-4 w-4" />Attendance</TabsTrigger>
          <TabsTrigger value="rules"><ScrollText className="mr-2 h-4 w-4" />Workplace Rules</TabsTrigger>
          <TabsTrigger value="payroll"><Wallet className="mr-2 h-4 w-4" />Payroll / Salary</TabsTrigger>
        </TabsList>

        {/* ---------------- Employees ---------------- */}
        <TabsContent value="employees" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name, code, designation..." value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} />
            </div>
            <Select value={empStatus} onValueChange={setEmpStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setEmpForm(emptyEmployee()); setEmpDialog(true); }}><Plus className="mr-2 h-4 w-4" />Add Employee</Button>
          </div>

          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Sr #</TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead>
                <TableHead>Designation</TableHead><TableHead>Department</TableHead><TableHead>Phone</TableHead>
                <TableHead>Join Date</TableHead><TableHead className="text-right">Salary</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 && <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">No employees yet</TableCell></TableRow>}
                {filteredEmployees.map((e, i) => (
                  <TableRow key={e.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{e.code || "-"}</TableCell>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.designation || "-"}</TableCell>
                    <TableCell>{e.department || "-"}</TableCell>
                    <TableCell>{e.phone || "-"}</TableCell>
                    <TableCell>{e.joinDate ? formatDate(e.joinDate) : "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.salary)}</TableCell>
                    <TableCell>{statusBadge(e.status)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => { setEmpForm({ ...e }); setEmpDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                      <ConfirmDeleteDialog onConfirm={() => { void employees.remove(e.id); }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ---------------- Attendance ---------------- */}
        <TabsContent value="attendance" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" className="w-44" value={attDate} onChange={(e) => setAttDate(e.target.value)} />
            <Select value={attEmployee} onValueChange={setAttEmployee}>
              <SelectTrigger className="w-56"><SelectValue placeholder="All employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.data.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setAttDate(""); setAttEmployee("all"); }}>Clear</Button>
            <Button className="ml-auto" onClick={() => { setAttForm(emptyAttendance()); setAttDialog(true); }}><Plus className="mr-2 h-4 w-4" />Mark Attendance</Button>
          </div>

          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Sr #</TableHead><TableHead>Date</TableHead><TableHead>Employee</TableHead>
                <TableHead>Check In</TableHead><TableHead>Check Out</TableHead><TableHead className="text-right">Hours</TableHead>
                <TableHead>Status</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredAttendance.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No attendance records</TableCell></TableRow>}
                {filteredAttendance.map((a, i) => (
                  <TableRow key={a.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{formatDate(a.date)}</TableCell>
                    <TableCell className="font-medium">{a.employeeName}</TableCell>
                    <TableCell>{a.checkIn || "-"}</TableCell>
                    <TableCell>{a.checkOut || "-"}</TableCell>
                    <TableCell className="text-right">{a.hours || 0}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{a.notes || "-"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => { setAttForm({ ...a }); setAttDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                      <ConfirmDeleteDialog onConfirm={() => { void attendance.remove(a.id); }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ---------------- Workplace Rules ---------------- */}
        <TabsContent value="rules" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => { setRuleForm({ ...emptyRule(), sortOrder: rules.data.length + 1 }); setRuleDialog(true); }}><Plus className="mr-2 h-4 w-4" />Add Rule</Button>
          </div>
          {sortedRules.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">No workplace rules added yet</CardContent></Card>}
          <div className="space-y-3">
            {sortedRules.map((r, i) => (
              <Card key={r.id}>
                <CardContent className="flex gap-4 p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{r.title}</h3>
                      {r.category && <Badge variant="secondary">{r.category}</Badge>}
                      {r.effectiveDate && <span className="text-xs text-muted-foreground">Effective {formatDate(r.effectiveDate)}</span>}
                    </div>
                    {r.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.description}</p>}
                  </div>
                  <div className="flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => { setRuleForm({ ...r }); setRuleDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                    <ConfirmDeleteDialog onConfirm={() => { void rules.remove(r.id); }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ---------------- Payroll ---------------- */}
        <TabsContent value="payroll" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input type="month" className="w-44" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} />
            <Button variant="outline" onClick={() => setPayMonth("")}>Clear</Button>
            <Button variant="outline" onClick={generatePayroll}>Generate Salary Sheet</Button>
            <Button className="ml-auto" onClick={() => { setPayForm(emptyPayroll()); setPayDialog(true); }}><Plus className="mr-2 h-4 w-4" />Add Salary Entry</Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Net Pay</p><p className="text-xl font-semibold">{formatCurrency(payrollTotals.net)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-semibold text-emerald-600">{formatCurrency(payrollTotals.paid)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-semibold text-amber-600">{formatCurrency(payrollTotals.pending)}</p></CardContent></Card>
          </div>

          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Sr #</TableHead><TableHead>Month</TableHead><TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Allowances</TableHead>
                <TableHead className="text-right">Overtime</TableHead><TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Advance</TableHead><TableHead className="text-right">Net Pay</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredPayroll.length === 0 && <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">No salary entries</TableCell></TableRow>}
                {filteredPayroll.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{p.month}</TableCell>
                    <TableCell className="font-medium">{p.employeeName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.basicSalary)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.allowances)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.overtime)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.deductions)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.advance)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(netOf(p))}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => { setPayForm({ ...p }); setPayDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                      <ConfirmDeleteDialog onConfirm={() => { void payroll.remove(p.id); }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Employee dialog */}
      <Dialog open={empDialog} onOpenChange={setEmpDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{employees.data.some((e) => e.id === empForm.id) ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Employee Code</Label><Input value={empForm.code} onChange={(e) => setEmpForm({ ...empForm, code: e.target.value })} /></div>
            <div><Label>Name *</Label><Input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} /></div>
            <div><Label>Designation</Label><Input value={empForm.designation} onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })} /></div>
            <div><Label>Department</Label><Input value={empForm.department} onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} /></div>
            <div><Label>CNIC</Label><Input value={empForm.cnic} onChange={(e) => setEmpForm({ ...empForm, cnic: e.target.value })} /></div>
            <div><Label>Join Date</Label><Input type="date" value={empForm.joinDate} onChange={(e) => setEmpForm({ ...empForm, joinDate: e.target.value })} /></div>
            <div><Label>Monthly Salary</Label><Input type="number" value={empForm.salary} onChange={(e) => setEmpForm({ ...empForm, salary: Number(e.target.value) || 0 })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={empForm.status} onValueChange={(v) => setEmpForm({ ...empForm, status: v as Employee["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Address</Label><Input value={empForm.address} onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={empForm.notes} onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEmpDialog(false)}>Cancel</Button><Button onClick={saveEmployee}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance dialog */}
      <Dialog open={attDialog} onOpenChange={setAttDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attendance</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Employee *</Label>
              <Select value={attForm.employeeId} onValueChange={(v) => setAttForm({ ...attForm, employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.data.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date *</Label><Input type="date" value={attForm.date} onChange={(e) => setAttForm({ ...attForm, date: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={attForm.status} onValueChange={(v) => setAttForm({ ...attForm, status: v as AttendanceRecord["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="half-day">Half Day</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Check In</Label><Input type="time" value={attForm.checkIn} onChange={(e) => setAttForm({ ...attForm, checkIn: e.target.value })} /></div>
            <div><Label>Check Out</Label><Input type="time" value={attForm.checkOut} onChange={(e) => setAttForm({ ...attForm, checkOut: e.target.value })} /></div>
            <div className="sm:col-span-2 text-sm text-muted-foreground">Working hours: <span className="font-medium text-foreground">{hoursBetween(attForm.checkIn, attForm.checkOut)}</span></div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={attForm.notes} onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAttDialog(false)}>Cancel</Button><Button onClick={saveAttendance}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule dialog */}
      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Workplace Rule</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Title *</Label><Input value={ruleForm.title} onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Category</Label>
                <Select value={ruleForm.category} onValueChange={(v) => setRuleForm({ ...ruleForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["General", "Timing", "Leave", "Safety", "Conduct", "Payroll"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Effective Date</Label><Input type="date" value={ruleForm.effectiveDate} onChange={(e) => setRuleForm({ ...ruleForm, effectiveDate: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea rows={4} value={ruleForm.description} onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })} /></div>
            <div><Label>Order</Label><Input type="number" value={ruleForm.sortOrder} onChange={(e) => setRuleForm({ ...ruleForm, sortOrder: Number(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRuleDialog(false)}>Cancel</Button><Button onClick={saveRule}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payroll dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Salary Entry</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Employee *</Label>
              <Select
                value={payForm.employeeId}
                onValueChange={(v) => {
                  const emp = employees.data.find((e) => e.id === v);
                  setPayForm({ ...payForm, employeeId: v, employeeName: emp?.name || "", basicSalary: payForm.basicSalary || emp?.salary || 0 });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.data.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Month *</Label><Input type="month" value={payForm.month} onChange={(e) => setPayForm({ ...payForm, month: e.target.value })} /></div>
            <div><Label>Basic Salary</Label><Input type="number" value={payForm.basicSalary} onChange={(e) => setPayForm({ ...payForm, basicSalary: Number(e.target.value) || 0 })} /></div>
            <div><Label>Allowances</Label><Input type="number" value={payForm.allowances} onChange={(e) => setPayForm({ ...payForm, allowances: Number(e.target.value) || 0 })} /></div>
            <div><Label>Overtime</Label><Input type="number" value={payForm.overtime} onChange={(e) => setPayForm({ ...payForm, overtime: Number(e.target.value) || 0 })} /></div>
            <div><Label>Deductions</Label><Input type="number" value={payForm.deductions} onChange={(e) => setPayForm({ ...payForm, deductions: Number(e.target.value) || 0 })} /></div>
            <div><Label>Advance</Label><Input type="number" value={payForm.advance} onChange={(e) => setPayForm({ ...payForm, advance: Number(e.target.value) || 0 })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={payForm.status} onValueChange={(v) => setPayForm({ ...payForm, status: v as PayrollEntry["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Paid Date</Label><Input type="date" value={payForm.paidDate} onChange={(e) => setPayForm({ ...payForm, paidDate: e.target.value })} /></div>
            <div><Label>Payment Method</Label><Input value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
            <div className="sm:col-span-2 rounded-lg bg-muted/50 p-3 text-sm">Net Pay: <span className="text-base font-semibold">{formatCurrency(netOf(payForm))}</span></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPayDialog(false)}>Cancel</Button><Button onClick={savePayroll}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
