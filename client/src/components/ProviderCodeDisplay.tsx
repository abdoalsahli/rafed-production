import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface ProviderCodeDisplayProps {
  providerCode: string;
  providerName: string;
}

export function ProviderCodeDisplay({ providerCode, providerName }: ProviderCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(providerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-[#eff4ff] border-[#dce1ff]" dir="rtl">
      <CardHeader>
        <CardTitle className="text-lg text-[#00236f]">رمز المزود الخاص بك</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-[#444651] mb-2">شارك هذا الرمز مع الموزعين للتواصل معهم</p>
          <div className="flex items-center gap-2 bg-white p-4 rounded-lg border-2 border-[#dce1ff]">
            <code className="flex-1 text-2xl font-mono font-bold text-[#00236f] num" dir="ltr">
              {providerCode}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-[#0f766e]" />
                  تم النسخ
                </>
              ) : (
                <>
                  <Copy size={16} />
                  نسخ
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-[#dce1ff]">
          <p className="text-xs text-[#444651]">
            <span className="font-semibold">كيف يعمل:</span> يمكن للموزعين استخدام هذا الرمز للعثور عليك والتواصل معك. سيرسلون طلب اتصال يمكنك قبوله أو رفضه.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white p-2 rounded border border-[#dce1ff]">
            <p className="text-[#444651]">اسم المزود</p>
            <p className="font-semibold text-[#00236f]">{providerName}</p>
          </div>
          <div className="bg-white p-2 rounded border border-[#dce1ff]">
            <p className="text-[#444651]">الحالة</p>
            <p className="font-semibold text-[#0f766e]">نشط</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
