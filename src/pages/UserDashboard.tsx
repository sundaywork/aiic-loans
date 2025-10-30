import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { DollarSign, LogOut, Calendar, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import logo from "@/assets/logo.png";

export default function UserDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState<any>(null);
  const [loan, setLoan] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    // Load application
    const { data: appData } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setApplication(appData);

    // Load loan if funded
    if (appData?.status === "funded") {
      const { data: loanData } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      setLoan(loanData);

      // Load payments
      if (loanData) {
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("*")
          .eq("loan_id", loanData.id)
          .order("payment_date", { ascending: false });

        setPayments(paymentsData || []);
      }
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Taxi Driver Loans Logo" className="h-8 w-8" />
            <h1 className="text-xl font-bold">Taxi Driver Loans</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Welcome, {user?.email}</h2>
          <p className="text-muted-foreground">Manage your loan application and payments</p>
        </div>

        {!application ? (
          <Card>
            <CardHeader>
              <CardTitle>Apply for a Loan</CardTitle>
              <CardDescription>
                Start your loan application to get the funding you need
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/apply")}>Start Application</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Application Status</CardTitle>
                  <StatusBadge status={application.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Requested Amount</p>
                    <p className="text-2xl font-bold">${application.requested_amount}</p>
                  </div>
                  {application.approved_amount && (
                    <div>
                      <p className="text-sm text-muted-foreground">Approved Amount</p>
                      <p className="text-2xl font-bold">${application.approved_amount}</p>
                    </div>
                  )}
                </div>

                {application.pending_notes && (
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                    <p className="text-sm font-medium">Action Required:</p>
                    <p className="text-sm text-muted-foreground">{application.pending_notes}</p>
                  </div>
                )}

                {application.rejection_reason && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <p className="text-sm font-medium">Rejection Reason:</p>
                    <p className="text-sm text-muted-foreground">{application.rejection_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {loan && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Active Loan</CardTitle>
                    <CardDescription>Your current loan details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Principal</p>
                        <p className="text-lg font-semibold">${loan.principal_amount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                        <p className="text-lg font-semibold">${loan.total_amount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Interest Rate</p>
                        <p className="text-lg font-semibold">{loan.interest_rate}% APR</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-primary/10 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="h-5 w-5 text-primary" />
                          <p className="text-sm font-medium">Remaining Balance</p>
                        </div>
                        <p className="text-3xl font-bold">${loan.remaining_balance}</p>
                      </div>

                      <div className="bg-muted rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <p className="text-sm font-medium">Next Payment</p>
                        </div>
                        <p className="text-2xl font-bold">
                          {format(new Date(loan.next_payment_date), "MMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          ${loan.weekly_payment} weekly
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Terms Remaining</p>
                        <p className="font-semibold">
                          {loan.terms_remaining} of {loan.terms_weeks} weeks
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {payments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Payment History</CardTitle>
                      <CardDescription>Your recent payments</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex justify-between items-center p-3 bg-muted rounded-lg"
                          >
                            <div>
                              <p className="font-medium">${payment.amount}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(payment.payment_date), "MMM d, yyyy")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Balance After</p>
                              <p className="font-semibold">${payment.remaining_balance_after}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
