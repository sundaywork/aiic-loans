import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { format, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { LogOut, Eye, CheckCircle, XCircle, Clock, FileText, Search, Upload, List, Grid, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";

export default function StaffDashboard() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [loanDetailsDialogOpen, setLoanDetailsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [loanViewMode, setLoanViewMode] = useState<"list" | "table">("list");
  const [loanSearch, setLoanSearch] = useState("");
  const [loanSortColumn, setLoanSortColumn] = useState<string | null>(null);
  const [loanSortDirection, setLoanSortDirection] = useState<"asc" | "desc">("asc");
  const [loanPage, setLoanPage] = useState(1);
  const [loansPerPage, setLoansPerPage] = useState(10);

  const [reviewData, setReviewData] = useState({
    status: "",
    approved_amount: "",
    rejection_reason: "",
    pending_notes: "",
  });

  const [fundData, setFundData] = useState({
    start_date: format(new Date(), "yyyy-MM-dd"),
  });

  const [paymentData, setPaymentData] = useState({
    loan_id: "",
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load applications with profiles
    const { data: appsData } = await supabase
      .from("loan_applications")
      .select(`
        *,
        profiles!loan_applications_user_id_fkey (
          full_name,
          email,
          phone_number
        )
      `)
      .order("created_at", { ascending: false });

    setApplications(appsData || []);

    // Load loans with profiles
    const { data: loansData } = await supabase
      .from("loans")
      .select(`
        *,
        profiles!loans_user_id_fkey (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    setLoans(loansData || []);

    // Load payments with loan and profile data
    const { data: paymentsData } = await supabase
      .from("payments")
      .select(`
        *,
        loans!payments_loan_id_fkey (
          id,
          profiles!loans_user_id_fkey (
            full_name,
            email
          )
        )
      `)
      .order("payment_date", { ascending: false });

    setPayments(paymentsData || []);
  };

  const getStorageUrl = (urlOrPath: string | null) => {
    if (!urlOrPath) return null;
    // If it's already a full URL, return it directly
    if (urlOrPath.startsWith('http')) return urlOrPath;
    // Otherwise, generate the public URL
    const { data } = supabase.storage.from("loan-documents").getPublicUrl(urlOrPath);
    return data.publicUrl;
  };

  const filteredPayments = useMemo(() => {
    if (!paymentSearch.trim()) return payments;

    const searchLower = paymentSearch.toLowerCase().trim();

    return payments.filter((payment) => {
      // Search by user name
      const userName = payment.loans?.profiles?.full_name?.toLowerCase() || "";
      if (userName.includes(searchLower)) return true;

      // Search by amount
      const amount = payment.amount?.toString() || "";
      if (amount.includes(searchLower)) return true;

      // Search by date (various formats)
      const paymentDate = new Date(payment.payment_date);
      
      // Try to parse as a date
      try {
        const searchDate = parseISO(searchLower);
        if (!isNaN(searchDate.getTime())) {
          // Check if same day
          if (format(paymentDate, "yyyy-MM-dd") === format(searchDate, "yyyy-MM-dd")) return true;
        }
      } catch (e) {
        // Not a valid date string
      }

      // Check for month name (e.g., "january", "jan")
      const monthNames = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
      ];
      const monthIndex = monthNames.findIndex(m => m.startsWith(searchLower));
      if (monthIndex !== -1) {
        if (paymentDate.getMonth() === monthIndex) return true;
      }

      // Check for year
      if (searchLower.length === 4 && !isNaN(Number(searchLower))) {
        if (paymentDate.getFullYear().toString() === searchLower) return true;
      }

      // Check if searching for "this week" or "this month"
      const now = new Date();
      if (searchLower === "this week") {
        return isWithinInterval(paymentDate, {
          start: startOfWeek(now),
          end: endOfWeek(now)
        });
      }
      if (searchLower === "this month") {
        return isWithinInterval(paymentDate, {
          start: startOfMonth(now),
          end: endOfMonth(now)
        });
      }

      // Check formatted date string
      const formattedDate = format(paymentDate, "MMM d, yyyy").toLowerCase();
      if (formattedDate.includes(searchLower)) return true;

      return false;
    });
  }, [payments, paymentSearch]);

  const filteredLoans = useMemo(() => {
    if (!loanSearch.trim()) return loans;

    const searchLower = loanSearch.toLowerCase().trim();

    return loans.filter((loan) => {
      // Search by user name
      const userName = loan.profiles?.full_name?.toLowerCase() || "";
      if (userName.includes(searchLower)) return true;

      // Search by principal amount
      const principal = loan.principal_amount?.toString() || "";
      if (principal.includes(searchLower)) return true;

      // Search by remaining balance
      const balance = loan.remaining_balance?.toString() || "";
      if (balance.includes(searchLower)) return true;

      // Search by date (various formats)
      const startDate = new Date(loan.start_date);
      const nextPaymentDate = new Date(loan.next_payment_date);
      
      // Try to parse as a date
      try {
        const searchDate = parseISO(searchLower);
        if (!isNaN(searchDate.getTime())) {
          const searchDateStr = format(searchDate, "yyyy-MM-dd");
          if (format(startDate, "yyyy-MM-dd") === searchDateStr) return true;
          if (format(nextPaymentDate, "yyyy-MM-dd") === searchDateStr) return true;
        }
      } catch (e) {
        // Not a valid date string
      }

      // Check for month name
      const monthNames = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
      ];
      const monthIndex = monthNames.findIndex(m => m.startsWith(searchLower));
      if (monthIndex !== -1) {
        if (startDate.getMonth() === monthIndex) return true;
        if (nextPaymentDate.getMonth() === monthIndex) return true;
      }

      // Check for year
      if (searchLower.length === 4 && !isNaN(Number(searchLower))) {
        if (startDate.getFullYear().toString() === searchLower) return true;
        if (nextPaymentDate.getFullYear().toString() === searchLower) return true;
      }

      return false;
    });
  }, [loans, loanSearch]);

  const sortedLoans = useMemo(() => {
    if (!loanSortColumn) return filteredLoans;

    return [...filteredLoans].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (loanSortColumn) {
        case "name":
          aValue = a.profiles?.full_name?.toLowerCase() || "";
          bValue = b.profiles?.full_name?.toLowerCase() || "";
          break;
        case "email":
          aValue = a.profiles?.email?.toLowerCase() || "";
          bValue = b.profiles?.email?.toLowerCase() || "";
          break;
        case "status":
          aValue = a.status?.toLowerCase() || "";
          bValue = b.status?.toLowerCase() || "";
          break;
        case "principal":
          aValue = parseFloat(a.principal_amount) || 0;
          bValue = parseFloat(b.principal_amount) || 0;
          break;
        case "balance":
          aValue = parseFloat(a.remaining_balance) || 0;
          bValue = parseFloat(b.remaining_balance) || 0;
          break;
        case "terms":
          aValue = a.terms_remaining || 0;
          bValue = b.terms_remaining || 0;
          break;
        case "next_payment":
          aValue = new Date(a.next_payment_date).getTime();
          bValue = new Date(b.next_payment_date).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return loanSortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return loanSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredLoans, loanSortColumn, loanSortDirection]);

  const handleLoanSort = (column: string) => {
    if (loanSortColumn === column) {
      setLoanSortDirection(loanSortDirection === "asc" ? "desc" : "asc");
    } else {
      setLoanSortColumn(column);
      setLoanSortDirection("asc");
    }
  };

  const paginatedLoans = useMemo(() => {
    const startIndex = (loanPage - 1) * loansPerPage;
    const endIndex = startIndex + loansPerPage;
    return sortedLoans.slice(startIndex, endIndex);
  }, [sortedLoans, loanPage, loansPerPage]);

  const totalLoanPages = Math.ceil(sortedLoans.length / loansPerPage);

  const SortIcon = ({ column }: { column: string }) => {
    if (loanSortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return loanSortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  const handleReviewApplication = (app: any) => {
    setSelectedApp(app);
    setReviewData({
      status: app.status,
      approved_amount: app.approved_amount || app.requested_amount,
      rejection_reason: app.rejection_reason || "",
      pending_notes: app.pending_notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("loan_applications")
        .update({
          status: reviewData.status,
          approved_amount: reviewData.status === "approved" ? parseFloat(reviewData.approved_amount) : null,
          rejection_reason: reviewData.status === "rejected" ? reviewData.rejection_reason : null,
          pending_notes: reviewData.status === "pending" ? reviewData.pending_notes : null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", selectedApp.id);

      if (error) throw error;

      toast.success("Application updated successfully");
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFundLoan = async () => {
    setLoading(true);
    try {
      const app = selectedApp;
      const startDate = new Date(fundData.start_date);
      const principal = parseFloat(app.approved_amount);
      const interestRate = app.interest_rate;
      
      // Use cents to avoid floating-point errors
      const principalCents = Math.round(principal * 100);
      const interestCents = Math.round(principalCents * (interestRate / 100));
      const totalAmountCents = principalCents + interestCents;
      const totalAmount = (totalAmountCents / 100).toFixed(2);
      const weeklyPaymentCents = Math.round(totalAmountCents / app.terms_weeks);
      const weeklyPayment = (weeklyPaymentCents / 100).toFixed(2);

      const nextPaymentDate = new Date(startDate);
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);

      const { error: loanError } = await supabase.from("loans").insert({
        application_id: app.id,
        user_id: app.user_id,
        principal_amount: principal,
        interest_rate: interestRate,
        total_amount: parseFloat(totalAmount),
        remaining_balance: parseFloat(totalAmount),
        terms_weeks: app.terms_weeks,
        weekly_payment: parseFloat(weeklyPayment),
        terms_remaining: app.terms_weeks,
        start_date: fundData.start_date,
        next_payment_date: nextPaymentDate.toISOString().split("T")[0],
      });

      if (loanError) throw loanError;

      const { error: appError } = await supabase
        .from("loan_applications")
        .update({ status: "funded" })
        .eq("id", app.id);

      if (appError) throw appError;

      toast.success("Loan funded successfully");
      setFundDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    setLoading(true);
    try {
      const loan = loans.find((l) => l.id === paymentData.loan_id);
      if (!loan) return;

      // Convert to cents to avoid floating-point errors
      const paymentAmountCents = Math.round(parseFloat(paymentData.amount) * 100);
      const currentBalanceCents = Math.round(parseFloat(loan.remaining_balance) * 100);
      const newBalanceCents = Math.max(0, currentBalanceCents - paymentAmountCents);
      const newBalance = (newBalanceCents / 100).toFixed(2);
      
      const termsRemaining = newBalanceCents === 0 ? 0 : Math.ceil(newBalanceCents / (Math.round(parseFloat(loan.weekly_payment) * 100)));

      // Record payment
      const { error: paymentError } = await supabase.from("payments").insert({
        loan_id: paymentData.loan_id,
        user_id: loan.user_id,
        amount: parseFloat(paymentData.amount),
        payment_date: paymentData.payment_date,
        remaining_balance_after: parseFloat(newBalance),
        notes: paymentData.notes,
        recorded_by: user!.id,
      });

      if (paymentError) throw paymentError;

      // Update loan
      const nextPaymentDate = new Date(paymentData.payment_date);
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);

      const { error: loanError } = await supabase
        .from("loans")
        .update({
          remaining_balance: parseFloat(newBalance),
          terms_remaining: termsRemaining,
          next_payment_date: nextPaymentDate.toISOString().split("T")[0],
          status: parseFloat(newBalance) === 0 ? "completed" : "active",
        })
        .eq("id", paymentData.loan_id);

      if (loanError) throw loanError;

      toast.success("Payment recorded successfully");
      setPaymentData({
        loan_id: "",
        amount: "",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        notes: "",
      });
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-8 w-8" />
            <h1 className="text-xl font-bold">Staff Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/import")}>
              <Upload className="h-4 w-4 mr-2" />
              Import Data
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="applications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Loan Applications</CardTitle>
                <CardDescription>Review and manage loan applications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div key={app.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold">{app.profiles?.full_name || "N/A"}</h3>
                          <p className="text-sm text-muted-foreground">{app.profiles?.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Phone: {app.profiles?.phone_number || "N/A"}
                          </p>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Requested</p>
                          <p className="font-semibold">${app.requested_amount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Terms</p>
                          <p className="font-semibold">{app.terms_weeks} weeks</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Weekly Payment</p>
                          <p className="font-semibold">${app.weekly_payment?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Submitted</p>
                          <p className="font-semibold">
                            {format(new Date(app.submitted_at), "MMM d")}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setSelectedApp(app);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReviewApplication(app)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Review
                        </Button>
                        {app.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedApp(app);
                              setFundDialogOpen(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Fund Loan
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Loans</CardTitle>
                <CardDescription>Monitor active loans and balances</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder='Search by user name, amount, or date (e.g., "2025-01-15", "January")'
                      value={loanSearch}
                      onChange={(e) => {
                        setLoanSearch(e.target.value);
                        setLoanPage(1); // Reset to first page on search
                      }}
                      className="max-w-2xl"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</Label>
                      <Select 
                        value={loansPerPage.toString()} 
                        onValueChange={(value) => {
                          setLoansPerPage(parseInt(value));
                          setLoanPage(1);
                        }}
                      >
                        <SelectTrigger className="w-20 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1 border rounded-md p-1">
                      <Button
                        variant={loanViewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setLoanViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={loanViewMode === "table" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setLoanViewMode("table")}
                      >
                        <Grid className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {sortedLoans.length > 0 ? (
                  loanViewMode === "list" ? (
                    <div className="space-y-4">
                      {paginatedLoans.map((loan) => (
                        <div key={loan.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="font-semibold">{loan.profiles?.full_name || "N/A"}</h3>
                              <p className="text-sm text-muted-foreground">{loan.profiles?.email}</p>
                            </div>
                            <StatusBadge status={loan.status} />
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Principal</p>
                              <p className="font-semibold">${loan.principal_amount}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Balance</p>
                              <p className="font-semibold text-primary">${loan.remaining_balance}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Terms Left</p>
                              <p className="font-semibold">
                                {loan.terms_remaining}/{loan.terms_weeks}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Next Payment</p>
                              <p className="font-semibold">
                                {format(new Date(loan.next_payment_date), "MMM d")}
                              </p>
                            </div>
                          </div>

                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedLoan(loan);
                              setLoanDetailsDialogOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Details & Payments
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleLoanSort("name")}
                            >
                              <div className="flex items-center">
                                Borrower
                                <SortIcon column="name" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleLoanSort("email")}
                            >
                              <div className="flex items-center">
                                Email
                                <SortIcon column="email" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleLoanSort("status")}
                            >
                              <div className="flex items-center">
                                Status
                                <SortIcon column="status" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleLoanSort("principal")}
                            >
                              <div className="flex items-center justify-end">
                                Principal
                                <SortIcon column="principal" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleLoanSort("balance")}
                            >
                              <div className="flex items-center justify-end">
                                Balance
                                <SortIcon column="balance" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer hover:bg-muted/50"
                              onClick={() => handleLoanSort("terms")}
                            >
                              <div className="flex items-center justify-end">
                                Terms Left
                                <SortIcon column="terms" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleLoanSort("next_payment")}
                            >
                              <div className="flex items-center">
                                Next Payment
                                <SortIcon column="next_payment" />
                              </div>
                            </TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedLoans.map((loan) => (
                            <TableRow key={loan.id}>
                              <TableCell className="font-medium">
                                {loan.profiles?.full_name || "N/A"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {loan.profiles?.email || "N/A"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={loan.status} />
                              </TableCell>
                              <TableCell className="text-right">
                                ${loan.principal_amount}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary">
                                ${loan.remaining_balance}
                              </TableCell>
                              <TableCell className="text-right">
                                {loan.terms_remaining}/{loan.terms_weeks}
                              </TableCell>
                              <TableCell>
                                {format(new Date(loan.next_payment_date), "MMM d")}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedLoan(loan);
                                    setLoanDetailsDialogOpen(true);
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {loanSearch ? "No loans found matching your search" : "No loans yet"}
                  </p>
                )}

                {sortedLoans.length > 0 && totalLoanPages > 1 && (
                  <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-muted-foreground">
                      Showing {((loanPage - 1) * loansPerPage) + 1} to {Math.min(loanPage * loansPerPage, sortedLoans.length)} of {sortedLoans.length} loans
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLoanPage(p => Math.max(1, p - 1))}
                        disabled={loanPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">Page</span>
                        <Input
                          type="number"
                          min={1}
                          max={totalLoanPages}
                          value={loanPage}
                          onChange={(e) => {
                            const page = parseInt(e.target.value);
                            if (page >= 1 && page <= totalLoanPages) {
                              setLoanPage(page);
                            }
                          }}
                          className="w-16 h-8 text-center"
                        />
                        <span className="text-muted-foreground">of {totalLoanPages}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLoanPage(p => Math.min(totalLoanPages, p + 1))}
                        disabled={loanPage === totalLoanPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Record Payment</CardTitle>
                <CardDescription>Manually record a loan payment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Loan</Label>
                    <Select value={paymentData.loan_id} onValueChange={(value) => setPaymentData({ ...paymentData, loan_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a loan" />
                      </SelectTrigger>
                      <SelectContent>
                        {loans.filter((l) => l.status === "active").map((loan) => (
                          <SelectItem key={loan.id} value={loan.id}>
                            {loan.profiles?.full_name} - ${loan.remaining_balance} balance
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payment Amount ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Date</Label>
                      <Input
                        type="date"
                        value={paymentData.payment_date}
                        onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      value={paymentData.notes}
                      onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    />
                  </div>

                  <Button onClick={handleRecordPayment} disabled={loading || !paymentData.loan_id || !paymentData.amount}>
                    {loading ? "Recording..." : "Record Payment"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>View all recorded payments across all loans</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder='Search by user name, amount, or date (e.g., "2025-01-15", "this week", "this month", "January")'
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    className="max-w-2xl"
                  />
                </div>

                {filteredPayments.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Borrower</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Balance After</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {format(new Date(payment.payment_date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>{payment.loans?.profiles?.full_name || "N/A"}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {payment.loans?.profiles?.email || "N/A"}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              ${payment.amount}
                            </TableCell>
                            <TableCell className="text-right">
                              ${payment.remaining_balance_after}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-xs truncate">
                              {payment.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {paymentSearch ? "No payments found matching your search" : "No payments recorded yet"}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Review Application Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              Review and update the status of this loan application
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Applicant</p>
                  <p className="font-semibold">{selectedApp.profiles?.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-semibold">{selectedApp.profiles?.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested Amount</p>
                  <p className="font-semibold">${selectedApp.requested_amount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Terms</p>
                  <p className="font-semibold">{selectedApp.terms_weeks} weeks</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={reviewData.status} onValueChange={(value) => setReviewData({ ...reviewData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reviewData.status === "approved" && (
                <div className="space-y-2">
                  <Label>Approved Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={reviewData.approved_amount}
                    onChange={(e) => setReviewData({ ...reviewData, approved_amount: e.target.value })}
                  />
                </div>
              )}

              {reviewData.status === "rejected" && (
                <div className="space-y-2">
                  <Label>Rejection Reason</Label>
                  <Textarea
                    value={reviewData.rejection_reason}
                    onChange={(e) => setReviewData({ ...reviewData, rejection_reason: e.target.value })}
                  />
                </div>
              )}

              {reviewData.status === "pending" && (
                <div className="space-y-2">
                  <Label>Notes (What's needed?)</Label>
                  <Textarea
                    value={reviewData.pending_notes}
                    onChange={(e) => setReviewData({ ...reviewData, pending_notes: e.target.value })}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmitReview} disabled={loading} className="flex-1">
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fund Loan Dialog */}
      <Dialog open={fundDialogOpen} onOpenChange={setFundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund Loan</DialogTitle>
            <DialogDescription>Set the loan start date to fund this loan</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={fundData.start_date}
                onChange={(e) => setFundData({ start_date: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                First payment will be due one week after this date
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFundDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleFundLoan} disabled={loading} className="flex-1">
                {loading ? "Funding..." : "Fund Loan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Application Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>Complete information for this loan application</DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-6">
              {/* Applicant Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Applicant Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedApp.profiles?.full_name || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedApp.profiles?.email || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone Number</Label>
                    <p className="font-medium">{selectedApp.profiles?.phone_number || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <StatusBadge status={selectedApp.status} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Loan Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Loan Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Requested Amount</Label>
                    <p className="font-medium text-lg">${selectedApp.requested_amount}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Interest Rate (APR)</Label>
                    <p className="font-medium">{selectedApp.interest_rate}%</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Terms</Label>
                    <p className="font-medium">{selectedApp.terms_weeks} weeks</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Weekly Payment</Label>
                    <p className="font-medium">${selectedApp.weekly_payment?.toFixed(2)}</p>
                  </div>
                  {selectedApp.approved_amount && (
                    <div>
                      <Label className="text-muted-foreground">Approved Amount</Label>
                      <p className="font-medium text-green-600">${selectedApp.approved_amount}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Submitted Date</Label>
                    <p className="font-medium">{format(new Date(selectedApp.submitted_at), "PPP")}</p>
                  </div>
                </div>
              </div>

              {/* Review Notes */}
              {(selectedApp.rejection_reason || selectedApp.pending_notes) && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Review Notes</h3>
                  {selectedApp.rejection_reason && (
                    <div>
                      <Label className="text-muted-foreground">Rejection Reason</Label>
                      <p className="font-medium text-destructive">{selectedApp.rejection_reason}</p>
                    </div>
                  )}
                  {selectedApp.pending_notes && (
                    <div>
                      <Label className="text-muted-foreground">Pending Notes</Label>
                      <p className="font-medium">{selectedApp.pending_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Uploaded Documents */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Uploaded Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedApp.driver_license_url && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Driver's License</Label>
                      <img 
                        src={getStorageUrl(selectedApp.driver_license_url)} 
                        alt="Driver's License"
                        className="w-full rounded-lg border object-cover max-h-64"
                      />
                    </div>
                  )}
                  {selectedApp.taxi_front_url && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Taxi Front Photo</Label>
                      <img 
                        src={getStorageUrl(selectedApp.taxi_front_url)} 
                        alt="Taxi Front"
                        className="w-full rounded-lg border object-cover max-h-64"
                      />
                    </div>
                  )}
                  {selectedApp.taxi_back_url && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Taxi Back Photo</Label>
                      <img 
                        src={getStorageUrl(selectedApp.taxi_back_url)} 
                        alt="Taxi Back"
                        className="w-full rounded-lg border object-cover max-h-64"
                      />
                    </div>
                  )}
                  {selectedApp.face_photo_url && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Face Photo</Label>
                      <img 
                        src={getStorageUrl(selectedApp.face_photo_url)} 
                        alt="Face Photo"
                        className="w-full rounded-lg border object-cover max-h-64"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Loan Details Dialog */}
      <Dialog open={loanDetailsDialogOpen} onOpenChange={setLoanDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
            <DialogDescription>Complete loan information and payment history</DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <div className="space-y-6">
              {/* Borrower Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Borrower Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedLoan.profiles?.full_name || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedLoan.profiles?.email || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <StatusBadge status={selectedLoan.status} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Start Date</Label>
                    <p className="font-medium">{format(new Date(selectedLoan.start_date), "PPP")}</p>
                  </div>
                </div>
              </div>

              {/* Loan Financial Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Loan Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Principal Amount</Label>
                    <p className="font-medium text-lg">${selectedLoan.principal_amount}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Total Amount (with interest)</Label>
                    <p className="font-medium text-lg">${selectedLoan.total_amount}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Remaining Balance</Label>
                    <p className="font-medium text-lg text-primary">${selectedLoan.remaining_balance}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Interest Rate (APR)</Label>
                    <p className="font-medium">{selectedLoan.interest_rate}%</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Weekly Payment</Label>
                    <p className="font-medium">${selectedLoan.weekly_payment}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Terms</Label>
                    <p className="font-medium">{selectedLoan.terms_remaining} / {selectedLoan.terms_weeks} weeks</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Next Payment Due</Label>
                    <p className="font-medium">{format(new Date(selectedLoan.next_payment_date), "PPP")}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Amount Paid</Label>
                    <p className="font-medium text-green-600">
                      ${(parseFloat(selectedLoan.total_amount) - parseFloat(selectedLoan.remaining_balance)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Payment History</h3>
                {payments.filter(p => p.loan_id === selectedLoan.id).length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium">Date</th>
                          <th className="text-left p-3 text-sm font-medium">Amount</th>
                          <th className="text-left p-3 text-sm font-medium">Balance After</th>
                          <th className="text-left p-3 text-sm font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments
                          .filter(p => p.loan_id === selectedLoan.id)
                          .map((payment) => (
                            <tr key={payment.id} className="border-t">
                              <td className="p-3 text-sm">
                                {format(new Date(payment.payment_date), "PPP")}
                              </td>
                              <td className="p-3 text-sm font-medium text-green-600">
                                ${payment.amount}
                              </td>
                              <td className="p-3 text-sm">
                                ${payment.remaining_balance_after}
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">
                                {payment.notes || "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No payments recorded yet</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setLoanDetailsDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
