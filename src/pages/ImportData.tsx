import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Upload, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ImportData() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [uploadingClients, setUploadingClients] = useState(false);
  const [uploadingLoans, setUploadingLoans] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

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
      // Skip first row (information only) and use second row as headers
      const loansRaw: any[] = XLSX.utils.sheet_to_json(loanSheet, { range: 1 });

      // Process clients and filter out rows with blank Full Name
      const clients = clientsRaw
        .map((row: any) => ({
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
        }))
        .filter((client: any) => client.full_name.trim() !== '');

      // Process loans with dynamic payment columns and filter out rows with blank Client No
      const loans = loansRaw
        .map((row: any) => {
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
        })
        .filter((loan: any) => loan.client_no.trim() !== '');

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

  const handleImportClients = async () => {
    if (!preview) return;

    setUploadingClients(true);
    try {
      // Limit to first 10 rows for debugging
      const limitedData = {
        clients: preview.clients.slice(0, 10),
        loans: []
      };
      
      const { data, error } = await supabase.functions.invoke("import-excel-data", {
        body: { ...limitedData, mode: 'clients' }
      });

      if (error) throw error;

      toast({
        title: "Client import completed (10 rows)",
        description: `Successfully imported: ${data.clients.success} clients`
      });

      if (data.clients.errors.length > 0) {
        console.error("Client import errors:", data.clients.errors);
        toast({
          title: "Some errors occurred",
          description: `${data.clients.errors.length} clients failed to import. Check console for details.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Client import failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploadingClients(false);
    }
  };

  const handleImportLoans = async () => {
    if (!preview) return;

    setUploadingLoans(true);
    try {
      // Limit to first 10 rows for debugging
      const limitedData = {
        clients: [],
        loans: preview.loans.slice(0, 10)
      };
      
      const { data, error } = await supabase.functions.invoke("import-excel-data", {
        body: { ...limitedData, mode: 'loans' }
      });

      if (error) throw error;

      toast({
        title: "Loan import completed (10 rows)",
        description: `Successfully imported: ${data.loans.success} loans, ${data.payments.success} payments`
      });

      if (data.loans.errors.length > 0 || data.payments.errors.length > 0) {
        console.error("Loan import errors:", data);
        toast({
          title: "Some errors occurred",
          description: `${data.loans.errors.length + data.payments.errors.length} items failed to import. Check console for details.`,
          variant: "destructive"
        });
      }

      setPreview(null);
      navigate("/staff");
    } catch (error) {
      toast({
        title: "Loan import failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploadingLoans(false);
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
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{preview.clients.length}</CardTitle>
                      <CardDescription>Total Clients</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{preview.loans.length}</CardTitle>
                      <CardDescription>Total Loans</CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                {/* Clients Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Clients Preview (First 10)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client No</TableHead>
                            <TableHead>Full Name</TableHead>
                            <TableHead>Occupation</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Address</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.clients.slice(0, 10).map((client: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{client.client_no}</TableCell>
                              <TableCell>{client.full_name}</TableCell>
                              <TableCell>{client.occupation}</TableCell>
                              <TableCell>{client.phone_number}</TableCell>
                              <TableCell>{client.address}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {preview.clients.length > 10 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        ...and {preview.clients.length - 10} more clients
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Loans Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Loans Preview (First 10)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {preview.loans.slice(0, 10).map((loan: any, idx: number) => (
                        <Collapsible
                          key={idx}
                          open={expandedLoan === loan.loan_no}
                          onOpenChange={(open) => setExpandedLoan(open ? loan.loan_no : null)}
                        >
                          <Card>
                            <CollapsibleTrigger className="w-full">
                              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4 text-left">
                                    {expandedLoan === loan.loan_no ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    <div>
                                      <CardTitle className="text-sm">
                                        Loan #{loan.loan_no} - {loan.client_name}
                                      </CardTitle>
                                      <CardDescription className="text-xs">
                                        Amount: ${loan.amount.toFixed(2)} | Terms: {loan.terms_weeks}w | 
                                        Status: {loan.status} | {loan.payments.length} payments
                                      </CardDescription>
                                    </div>
                                  </div>
                                </div>
                              </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <CardContent className="pt-0">
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                                    <div>
                                      <span className="font-semibold">Total Amount:</span> ${loan.total_amount.toFixed(2)}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Interest:</span> ${loan.interests.toFixed(2)}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Weekly Payment:</span> ${loan.weekly_repay_min.toFixed(2)}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Remaining:</span> ${loan.remain_repay_amount.toFixed(2)}
                                    </div>
                                  </div>
                                  
                                  <h5 className="font-semibold text-sm mb-2">Payments ({loan.payments.length})</h5>
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Date</TableHead>
                                          <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {loan.payments.map((payment: any, pidx: number) => (
                                          <TableRow key={pidx}>
                                            <TableCell className="text-xs">{payment.date}</TableCell>
                                            <TableCell className="text-right text-xs">
                                              ${payment.amount.toFixed(2)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      ))}
                    </div>
                    {preview.loans.length > 10 && (
                      <p className="text-sm text-muted-foreground mt-4">
                        ...and {preview.loans.length - 10} more loans
                      </p>
                    )}
                  </CardContent>
                </Card>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Excel Format Requirements:</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li><strong>Client List sheet:</strong> Client No, Full Name, Occupation, ID1/ID2 details, Address, Phone Number, Vehicle Number Plate, Late History</li>
                    <li><strong>Loan List sheet:</strong> Fixed columns (Loan No., Client No., Amount, Terms, etc.) + Dynamic payment date columns</li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={handleImportClients} disabled={uploadingClients || uploadingLoans} variant="outline">
                    {uploadingClients ? "Importing..." : "Import Clients (10 rows)"}
                  </Button>
                  <Button onClick={handleImportLoans} disabled={uploadingClients || uploadingLoans}>
                    {uploadingLoans ? "Importing..." : "Import Loans (10 rows)"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
