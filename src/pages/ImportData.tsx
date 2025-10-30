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
      const clientSheet = workbook.Sheets["Client List"];
      const loanSheet = workbook.Sheets["Loan List"];

      if (!clientSheet || !loanSheet) {
        throw new Error("Excel file must contain 'Client List' and 'Loan List' sheets");
      }

      const clientsRaw: any[] = XLSX.utils.sheet_to_json(clientSheet);
      const loansRaw: any[] = XLSX.utils.sheet_to_json(loanSheet);

      // Process clients
      const clients = clientsRaw.map((row: any) => ({
        client_no: row['Client No'] || '',
        full_name: row['Full Name'] || '',
        occupation: row['Occupation'] || '',
        id1_type: row['ID1 Type'] || '',
        id1_number: row['ID1 Number'] || '',
        id2_type: row['ID2 Type'] || '',
        id2_number: row['ID2 Number'] || '',
        address: row['Address'] || '',
        phone_number: row['Phone Number'] || '',
        vehicle_number_plate: row['Vehicle Number Plate'] || '',
        late_history: row['Late History'] ? parseInt(row['Late History']) : 0
      }));

      // Process loans with dynamic payment columns
      const loans = loansRaw.map((row: any) => {
        const payments: Array<{ date: string; amount: number }> = [];
        
        // Extract payment columns (all columns after fixed columns that contain dates)
        Object.keys(row).forEach((key) => {
          // Check if column is a date format and has a value
          if (key.includes('/') && row[key] && !isNaN(parseFloat(row[key]))) {
            const amount = parseFloat(row[key].toString().replace(/[$,]/g, ''));
            if (amount > 0) {
              payments.push({ date: key, amount });
            }
          }
        });

        return {
          loan_no: row['Loan No.'] || '',
          client_no: row['Client No.'] || '',
          client_name: row['Client Name'] || '',
          amount: parseFloat(row['Amount'] || 0),
          interests: parseFloat(row['Interests'] || 0),
          total_amount: parseFloat(row['Total Amount'] || 0),
          terms_weeks: parseInt(row['Terms(Week)'] || 0),
          weekly_repay_min: parseFloat(row['Weekly repay min'] || 0),
          signed_date: row['Signed Date'] || '',
          paid_by: row['Paid By'] || '',
          start_date: row['Start Date'] || '',
          first_repayment_date: row['First repayment date'] || '',
          end_date: row['End Date'] || '',
          status: row['Status'] || '',
          remain_repay_amount: parseFloat((row['Remain Repay Amount'] || '0').toString().replace(/[$,]/g, '')),
          payments
        };
      });

      setPreview({
        clients,
        loans
      });

      const totalPayments = loans.reduce((sum, loan) => sum + loan.payments.length, 0);
      toast({
        title: "File parsed successfully",
        description: `Found ${clients.length} clients, ${loans.length} loans with ${totalPayments} payments`
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
        body: preview
      });

      if (error) throw error;

      toast({
        title: "Import completed",
        description: `Successfully imported: ${data.clients.success} clients, ${data.loans.success} loans, ${data.payments.success} payments`
      });

      if (data.clients.errors.length > 0 || data.loans.errors.length > 0 || data.payments.errors.length > 0) {
        console.error("Import errors:", data);
        toast({
          title: "Some errors occurred",
          description: `${data.clients.errors.length + data.loans.errors.length + data.payments.errors.length} items failed to import. Check console for details.`,
          variant: "destructive"
        });
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
              Upload an Excel file with sheets named "Client List" and "Loan List"
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
                <div className="grid grid-cols-2 gap-4 text-center">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{preview.clients.length}</CardTitle>
                      <CardDescription>Clients</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{preview.loans.length}</CardTitle>
                      <CardDescription>Loans</CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Expected Excel Format:</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li><strong>Client List sheet:</strong> Client No, Full Name, Occupation, ID1/ID2 details, Address, Phone Number, Vehicle Number Plate, Late History</li>
                    <li><strong>Loan List sheet:</strong> Fixed columns (Loan No., Client No., Amount, Terms, etc.) + Dynamic payment date columns</li>
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
