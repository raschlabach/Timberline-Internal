import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRef, useState, useMemo, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { formatPhoneNumber } from "@/lib/utils";

interface FreightItem {
  packages: number;
  description: string;
  weight: number;
  charges: number;
}

interface BillOfLadingDialogProps {
  order: {
    id: string;
    shipper: {
      name: string;
      address: string;
      phone: string;
      phone2: string;
    };
    consignee: {
      name: string;
      address: string;
      phone: string;
      phone2: string;
    };
    items: Array<FreightItem>;
  };
  children?: React.ReactNode;
}

export function BillOfLadingDialog({ order, children }: BillOfLadingDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  
  // Group items by description and sum packages
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: FreightItem } = {};
    
    order.items.forEach(item => {
      const key = item.description || '';
      if (groups[key]) {
        // If description exists, add packages and combine weight/charges
        groups[key] = {
          ...groups[key],
          packages: groups[key].packages + item.packages,
          weight: groups[key].weight + item.weight,
          charges: groups[key].charges + item.charges
        };
      } else {
        // New description, add it
        groups[key] = { ...item };
      }
    });
    
    return Object.values(groups);
  }, [order.items]);
  
  const [items, setItems] = useState<FreightItem[]>(groupedItems);
  const [signatures, setSignatures] = useState({
    pickedUpBy: "",
    pickedUpDate: "",
    deliveredBy: "",
    deliveredDate: "",
    receivedBy: "",
    receivedDate: "",
  });
  
  // Update items when order changes (re-group if needed)
  useEffect(() => {
    setItems(groupedItems);
  }, [groupedItems]);
  
  // Add empty rows to make 8 total rows (reduced for single page fit)
  const emptyRows = Math.max(0, 8 - items.length);
  const allItems = [
    ...items,
    ...Array(emptyRows).fill({ packages: 0, description: "", weight: 0, charges: 0 })
  ];

  const handleItemChange = (index: number, field: keyof FreightItem, value: string) => {
    const newItems = [...items];
    if (index >= newItems.length) {
      // If editing an empty row, add it to the items array
      newItems[index] = { packages: 0, description: "", weight: 0, charges: 0 };
    }
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'description' ? value : Number(value) || 0
    };
    setItems(newItems);
  };

  const handleSignatureChange = (field: keyof typeof signatures, value: string) => {
    setSignatures(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handlePrint = useReactToPrint({
    documentTitle: `BOL-${order.id}`,
    pageStyle: `
      @page {
        size: letter;
        margin: 0.25in;
      }
      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
          margin: 0 !important;
          padding: 0 !important;
        }
        .print\\:hidden {
          display: none !important;
        }
        * {
          box-sizing: border-box;
        }
        .bol-print-root {
          width: 8in !important;
          min-height: 10.5in !important;
          height: 10.5in !important;
          max-height: 10.5in !important;
          padding: 0.25in !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: visible !important;
        }
        .bol-print-root *,
        .bol-print-root div {
          overflow: visible !important;
          max-height: none !important;
        }
      }
    `,
    contentRef: printRef,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
            BOL
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[52rem] w-auto max-h-[90vh] overflow-y-auto">
        <div 
          ref={printRef} 
          className="bol-print-root bg-white w-full flex flex-col relative z-0"
          style={{
            width: '8.5in',
            minHeight: '10.5in',
            padding: '0.25in',
            margin: '0 auto',
            boxSizing: 'border-box',
            fontSize: '12px'
          }}
        >
          {/* Title Section */}
          <div className="text-center mb-3">
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-2xl font-bold">Straight Bill of Lading</h1>
              <p className="text-sm font-bold">{new Date().toLocaleDateString('en-US', { 
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
              })}</p>
            </div>
            <div className="flex justify-between items-start">
              <div className="text-left text-sm">
                <p className="font-bold text-base mb-0.5">Timberline Trucking</p>
                <p className="text-xs">1361 County Road 102</p>
                <p className="text-xs">Sugarcreek, OH 44681</p>
                <p className="mt-0.5 text-xs">Phone: 330-852-3022</p>
              </div>
              <div className="flex items-center">
                <span className="font-bold mr-2 text-base">#</span>
                <Input 
                  placeholder="Enter BOL #" 
                  className="w-40 text-sm h-7"
                  defaultValue={order.id}
                />
              </div>
            </div>
          </div>

          {/* Shipper and Consignee Section */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border-2 border-gray-800 p-2">
              <h2 className="font-bold text-sm mb-1.5">FROM: SHIPPER</h2>
              <div className="space-y-0.5 text-xs min-w-[240px]">
                <p className="font-semibold mb-1 text-sm">{order.shipper.name}</p>
                <p className="text-xs break-words">{order.shipper.address}</p>
                <div className="mt-1.5 pt-1 border-t border-gray-200">
                  <p className="text-xs">Phone: {formatPhoneNumber(order.shipper.phone)}</p>
                  {order.shipper.phone2 && <p className="text-xs">Phone 2: {formatPhoneNumber(order.shipper.phone2)}</p>}
                </div>
              </div>
            </div>
            <div className="border-2 border-gray-800 p-2">
              <h2 className="font-bold text-sm mb-1.5">TO: CONSIGNEE</h2>
              <div className="space-y-0.5 text-xs min-w-[240px]">
                <p className="font-semibold mb-1 text-sm">{order.consignee.name}</p>
                <p className="text-xs break-words">{order.consignee.address}</p>
                <div className="mt-1.5 pt-1 border-t border-gray-200">
                  <p className="text-xs">Phone: {formatPhoneNumber(order.consignee.phone)}</p>
                  {order.consignee.phone2 && <p className="text-xs">Phone 2: {formatPhoneNumber(order.consignee.phone2)}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-2">
            <Table>
              <TableHeader>
                <TableRow className="border-t-2 border-x-2 border-gray-800">
                  <TableHead className="text-xs font-bold py-1.5 px-1 text-black">Number of Packages</TableHead>
                  <TableHead className="text-xs font-bold py-1.5 px-1 text-black">Description</TableHead>
                  <TableHead className="text-xs font-bold py-1.5 px-1 text-black">Weight</TableHead>
                  <TableHead className="text-xs font-bold py-1.5 px-1 text-black">Total Charges</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allItems.map((item, index) => (
                  <TableRow key={index} className="border-x-2 border-gray-800">
                    <TableCell className="text-xs py-1 px-1">
                      <Input
                        type="number"
                        value={item.packages || ""}
                        onChange={(e) => handleItemChange(index, "packages", e.target.value)}
                        className="border-0 p-0 h-5 text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-xs py-1 px-1">
                      <Input
                        type="text"
                        value={item.description || ""}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="border-0 p-0 h-5 text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-xs py-1 px-1">
                      <Input
                        type="number"
                        value={item.weight || ""}
                        onChange={(e) => handleItemChange(index, "weight", e.target.value)}
                        className="border-0 p-0 h-5 text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-xs py-1 px-1">
                      <Input
                        type="number"
                        value={item.charges || ""}
                        onChange={(e) => handleItemChange(index, "charges", e.target.value)}
                        className="border-0 p-0 h-5 text-xs"
                        prefix="$"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Signature Section */}
          <div className="flex flex-col gap-2 w-64 mt-auto">
            <div>
              <div className="border-b-2 border-black pt-3">
                <Input
                  type="text"
                  value={signatures.pickedUpBy}
                  onChange={(e) => handleSignatureChange("pickedUpBy", e.target.value)}
                  placeholder="Picked Up By"
                  className="border-0 p-0 h-auto text-sm font-bold"
                />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Input
                  type="text"
                  value={signatures.pickedUpDate}
                  onChange={(e) => handleSignatureChange("pickedUpDate", e.target.value)}
                  placeholder="Date"
                  className="border-0 p-0 h-auto text-xs text-gray-500"
                />
              </div>
            </div>
            <div>
              <div className="border-b-2 border-black pt-3">
                <Input
                  type="text"
                  value={signatures.deliveredBy}
                  onChange={(e) => handleSignatureChange("deliveredBy", e.target.value)}
                  placeholder="Delivered By"
                  className="border-0 p-0 h-auto text-sm font-bold"
                />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Input
                  type="text"
                  value={signatures.deliveredDate}
                  onChange={(e) => handleSignatureChange("deliveredDate", e.target.value)}
                  placeholder="Date"
                  className="border-0 p-0 h-auto text-xs text-gray-500"
                />
              </div>
            </div>
            <div>
              <div className="border-b-2 border-black pt-3">
                <Input
                  type="text"
                  value={signatures.receivedBy}
                  onChange={(e) => handleSignatureChange("receivedBy", e.target.value)}
                  placeholder="Received By"
                  className="border-0 p-0 h-auto text-sm font-bold"
                />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Input
                  type="text"
                  value={signatures.receivedDate}
                  onChange={(e) => handleSignatureChange("receivedDate", e.target.value)}
                  placeholder="Date"
                  className="border-0 p-0 h-auto text-xs text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Print Button */}
          <div className="text-center print:hidden mt-4">
            <Button onClick={() => handlePrint && handlePrint()} className="text-base px-8">Print</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}