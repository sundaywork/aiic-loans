import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export default function ImportData() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  if (!isAdmin) {
    navigate("/dashboard");
    return null;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      // Parse sheets
      const usersSheet = workbook.Sheets["Users"];
      const appsSheet = workbook.Sheets["Applications"];
      const paymentsSheet = workbook.Sheets["Payments"];

      const users = usersSheet ? XLSX.utils.sheet_to_json(usersSheet) : [];
      const loanApplications = appsSheet ? XLSX.utils.sheet_to_json(appsSheet) : [];
      const payments = paymentsSheet ? XLSX.utils.sheet_to_json(paymentsSheet) : [];

      setPreview({
        users,
        loanApplications,
        payments
      });

      toast({
        title: "File parsed successfully",
        description: `Found ${users.length} users, ${loanApplications.length} applications, ${payments.length} payments`
      });
    } catch (error) {
      toast({
        title: "Error parsing file",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-excel-data", {
        body: {
          users: preview.users.map((u: any) => ({
            email: u.email || u.Email,
            password: u.password || u.Password || "TempPass123!",
            full_name: u.full_name || u["Full Name"],
            phone_number: u.phone_number || u["Phone Number"],
            address: u.address || u.Address,
            bank_account: u.bank_account || u["Bank Account"]
          })),
          loanApplications: preview.loanApplications.map((a: any) => ({
            user_email: a.user_email || a["User Email"],
            requested_amount: parseFloat(a.requested_amount || a["Requested Amount"]),
            terms_weeks: parseInt(a.terms_weeks || a["Terms (Weeks)"]),
            status: a.status || a.Status || "submitted"
          })),
          payments: preview.payments.map((p: any) => ({
            user_email: p.user_email || p["User Email"],
            amount: parseFloat(p.amount || p.Amount),
            payment_date: p.payment_date || p["Payment Date"],
            notes: p.notes || p.Notes
          }))
        }
      });

      if (error) throw error;

      toast({
        title: "Import completed",
        description: `Successfully imported: ${data.users.success} users, ${data.loanApplications.success} applications, ${data.payments.success} payments`
      });

      if (data.users.errors.length > 0 || data.loanApplications.errors.length > 0 || data.payments.errors.length > 0) {
        console.error("Import errors:", data);
      }

      setPreview(null);
      navigate("/staff");
    } catch (error) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/staff")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Staff Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              Import Excel Data
            </CardTitle>
            <CardDescription>
              Upload an Excel file with sheets named "Users", "Applications", and "Payments"
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" asChild>
                  <span>Choose Excel File</span>
                </Button>
              </label>
            </div>

            {preview && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{preview.users.length}</CardTitle>
                      <CardDescription>Users</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{preview.loanApplications.length}</CardTitle>
                      <CardDescription>Applications</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{preview.payments.length}</CardTitle>
                      <CardDescription>Payments</CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Expected Excel Format:</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li><strong>Users sheet:</strong> email, password, full_name, phone_number, address, bank_account</li>
                    <li><strong>Applications sheet:</strong> user_email, requested_amount, terms_weeks, status</li>
                    <li><strong>Payments sheet:</strong> user_email, amount, payment_date, notes</li>
                  </ul>
                </div>

                <Button onClick={handleImport} disabled={uploading} className="w-full">
                  {uploading ? "Importing..." : "Import Data"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
