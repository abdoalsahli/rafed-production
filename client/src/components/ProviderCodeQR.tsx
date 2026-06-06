import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProviderCodeQRProps {
  providerCode: string;
  providerName: string;
}

export function ProviderCodeQR({
  providerCode,
  providerName,
}: ProviderCodeQRProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(providerCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert("Failed to copy provider code");
    }
  };

  const handleDownloadQR = () => {
    try {
      const svg = qrRef.current?.querySelector("svg") as SVGElement;
      if (!svg) {
        alert("QR code not found");
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `${providerName}-${providerCode}-qr.png`;
        link.click();
      };
      
      img.src = "data:image/svg+xml;base64," + btoa(svgData);
    } catch (error) {
      alert("Failed to download QR code");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <div className="space-y-4">
          {/* Provider Code Section */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Your Provider Code
            </label>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-3 font-mono text-lg font-semibold text-center border border-gray-200 dark:border-gray-700">
                {providerCode}
              </div>
              <Button
                onClick={handleCopyCode}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              Share this code with distributors so they can connect to you
            </p>
          </div>

          {/* QR Code Section */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              QR Code
            </label>
            <div className="flex flex-col items-center gap-4 mt-2">
              <div
                ref={qrRef}
                className="bg-white p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <QRCodeSVG
                  value={providerCode}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <Button
                onClick={handleDownloadQR}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download QR Code
              </Button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
              Distributors can scan this QR code to quickly enter your provider code
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
