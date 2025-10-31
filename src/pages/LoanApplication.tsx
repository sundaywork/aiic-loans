import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Upload, Calculator } from "lucide-react";

export default function LoanApplication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [taxiCompanies, setTaxiCompanies] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    address: "",
    bank_account: "",
    taxi_company_id: "",
    requested_amount: "",
    terms_weeks: "12",
  });

  const [files, setFiles] = useState({
    driver_license: null as File | null,
    taxi_front: null as File | null,
    taxi_back: null as File | null,
    face_photo: null as File | null,
  });

  const [loanPreview, setLoanPreview] = useState({
    amount: 0,
    interest: 0,
    total: 0,
    weekly: 0,
  });

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (formData.requested_amount && formData.terms_weeks) {
      calculateLoan();
    }
  }, [formData.requested_amount, formData.terms_weeks]);

  const loadData = async () => {
    const { data: companies } = await supabase
      .from("taxi_companies")
      .select("*")
      .eq("is_active", true);
    setTaxiCompanies(companies || []);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      setFormData((prev) => ({
        ...prev,
        full_name: profileData.full_name || "",
        phone_number: profileData.phone_number || "",
        address: profileData.address || "",
        bank_account: profileData.bank_account || "",
        taxi_company_id: profileData.taxi_company_id || "",
      }));
    }
  };

  const calculateLoan = () => {
    const amount = parseFloat(formData.requested_amount) || 0;
    const weeks = parseInt(formData.terms_weeks) || 1;
    const interestRate = 0.4; // 40% APR

    const interest = amount * interestRate;
    const total = amount + interest;
    const weekly = total / weeks;

    setLoanPreview({
      amount,
      interest,
      total,
      weekly,
    });
  };

  const handleFileChange = (field: keyof typeof files, file: File | null) => {
    setFiles((prev) => ({ ...prev, [field]: file }));
  };

  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("loan-documents")
      .upload(path, file);

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("loan-documents")
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update profile
      await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          address: formData.address,
          bank_account: formData.bank_account,
          taxi_company_id: formData.taxi_company_id,
        })
        .eq("id", user!.id);

      // Upload files
      const userId = user!.id;
      const timestamp = Date.now();
      
      const urls: any = {};
      
      if (files.driver_license) {
        urls.driver_license_url = await uploadFile(
          files.driver_license,
          `${userId}/driver-license-${timestamp}.${files.driver_license.name.split('.').pop()}`
        );
      }
      
      if (files.taxi_front) {
        urls.taxi_front_url = await uploadFile(
          files.taxi_front,
          `${userId}/taxi-front-${timestamp}.${files.taxi_front.name.split('.').pop()}`
        );
      }
      
      if (files.taxi_back) {
        urls.taxi_back_url = await uploadFile(
          files.taxi_back,
          `${userId}/taxi-back-${timestamp}.${files.taxi_back.name.split('.').pop()}`
        );
      }
      
      if (files.face_photo) {
        urls.face_photo_url = await uploadFile(
          files.face_photo,
          `${userId}/face-photo-${timestamp}.${files.face_photo.name.split('.').pop()}`
        );
      }

      // Create loan application
      const { error: appError } = await supabase
        .from("loan_applications")
        .insert({
          user_id: userId,
          requested_amount: parseFloat(formData.requested_amount),
          terms_weeks: parseInt(formData.terms_weeks),
          weekly_payment: loanPreview.weekly,
          ...urls,
        });

      if (appError) throw appError;

      toast.success("Application submitted successfully!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Loan Application</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Provide your basic details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank">Bank Account Number *</Label>
                <Input
                  id="bank"
                  value={formData.bank_account}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Taxi Company *</Label>
                <Select
                  value={formData.taxi_company_id}
                  onValueChange={(value) => setFormData({ ...formData, taxi_company_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your taxi company" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxiCompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loan Details</CardTitle>
              <CardDescription>Specify the loan amount and terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Requested Amount ($) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="100"
                    step="100"
                    value={formData.requested_amount}
                    onChange={(e) => setFormData({ ...formData, requested_amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">Repayment Terms *</Label>
                  <Select
                    value={formData.terms_weeks}
                    onValueChange={(value) => setFormData({ ...formData, terms_weeks: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8 weeks</SelectItem>
                      <SelectItem value="12">12 weeks</SelectItem>
                      <SelectItem value="16">16 weeks</SelectItem>
                      <SelectItem value="20">20 weeks</SelectItem>
                      <SelectItem value="24">24 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loanPreview.amount > 0 && (
                <div className="bg-primary/10 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Loan Preview</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Principal</p>
                      <p className="font-semibold">${loanPreview.amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Interest (40% APR)</p>
                      <p className="font-semibold">${loanPreview.interest.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Amount</p>
                      <p className="font-semibold">${loanPreview.total.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Weekly Payment</p>
                      <p className="font-semibold">${loanPreview.weekly.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents (Optional)</CardTitle>
              <CardDescription>Upload photos of your documents if available (max 5MB each)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "driver_license", label: "Driver's License", required: false },
                { key: "taxi_front", label: "Taxi Front Photo", required: false },
                { key: "taxi_back", label: "Taxi Back Photo", required: false },
                { key: "face_photo", label: "Face Photo", required: false },
              ].map((doc) => (
                <div key={doc.key} className="space-y-2">
                  <Label htmlFor={doc.key}>
                    {doc.label} {doc.required && "*"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={doc.key}
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleFileChange(doc.key as keyof typeof files, e.target.files?.[0] || null)
                      }
                    />
                    {files[doc.key as keyof typeof files] && (
                      <Upload className="h-5 w-5 text-success" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/")} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
