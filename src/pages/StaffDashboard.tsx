import { useEffect, useState } from "react";
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
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";
import { DollarSign, LogOut, Eye, CheckCircle, XCircle, Clock, FileText } from "lucide-react";

export default function StaffDashboard() {
  const { signOut, user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
      const interest = principal * (interestRate / 100);
      const totalAmount = principal + interest;
      const weeklyPayment = totalAmount / app.terms_weeks;

      const nextPaymentDate = new Date(startDate);
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);

      const { error: loanError } = await supabase.from("loans").insert({
        application_id: app.id,
        user_id: app.user_id,
        principal_amount: principal,
        interest_rate: interestRate,
        total_amount: totalAmount,
        remaining_balance: totalAmount,
        terms_weeks: app.terms_weeks,
        weekly_payment: weeklyPayment,
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

      const paymentAmount = parseFloat(paymentData.amount);
      const newBalance = Math.max(0, loan.remaining_balance - paymentAmount);
      const termsRemaining = Math.ceil(newBalance / loan.weekly_payment);

      // Record payment
      const { error: paymentError } = await supabase.from("payments").insert({
        loan_id: paymentData.loan_id,
        user_id: loan.user_id,
        amount: paymentAmount,
        payment_date: paymentData.payment_date,
        remaining_balance_after: newBalance,
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
          remaining_balance: newBalance,
          terms_remaining: termsRemaining,
          next_payment_date: nextPaymentDate.toISOString().split("T")[0],
          status: newBalance === 0 ? "completed" : "active",
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
          <div className="flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Staff Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
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
              <CardContent>
                <div className="space-y-4">
                  {loans.map((loan) => (
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
                    </div>
                  ))}
                </div>
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
                <CardDescription>View all recorded payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{payment.loans?.profiles?.full_name || "N/A"}</h4>
                          <p className="text-sm text-muted-foreground">{payment.loans?.profiles?.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">${payment.amount}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(payment.payment_date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Balance After Payment</span>
                        <span className="font-semibold">${payment.remaining_balance_after}</span>
                      </div>

                      {payment.notes && (
                        <p className="text-sm text-muted-foreground mt-2 border-t pt-2">{payment.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
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
    </div>
  );
}
