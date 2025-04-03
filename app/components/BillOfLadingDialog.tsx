import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";

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
  const [items, setItems] = useState<FreightItem[]>(order.items);
  const [signatures, setSignatures] = useState({
    pickedUpBy: "",
    pickedUpDate: "",
    deliveredBy: "",
    deliveredDate: "",
    receivedBy: "",
    receivedDate: "",
  });
  
  // Add empty rows to make 10 total rows
  const emptyRows = Math.max(0, 10 - items.length);
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
        margin: 0.5in;
      }
      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .print\\:hidden {
          display: none !important;
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
      <DialogContent className="max-w-[52rem] w-auto h-auto">
        <div 
          ref={printRef} 
          className="bg-white w-full h-full flex flex-col relative z-0"
          style={{
            width: '8.5in',
            minHeight: '11in',
            padding: '0.4in',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}
        >
          {/* Title Section */}
          <div className="text-center mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold">Straight Bill of Lading</h1>
              <p className="text-base font-bold">{new Date().toLocaleDateString('en-US', { 
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
              })}</p>
            </div>
            <div className="flex justify-between items-start">
              <div className="text-left text-base">
                <p className="font-bold text-lg mb-1">Timberline Trucking</p>
                <p>1361 County Road 102</p>
                <p>Sugarcreek, OH 44681</p>
                <p className="mt-1">Phone: 330-852-3022</p>
              </div>
              <div className="flex items-center">
                <span className="font-bold mr-2 text-lg">#</span>
                <Input 
                  placeholder="Enter BOL #" 
                  className="w-48 text-base"
                  defaultValue={order.id}
                />
              </div>
            </div>
          </div>

          {/* Shipper and Consignee Section */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="border-2 border-gray-800 p-4">
              <h2 className="font-bold text-lg mb-3">FROM: SHIPPER</h2>
              <div className="space-y-1 text-base min-w-[280px]">
                <p className="font-semibold mb-2">{order.shipper.name}</p>
                <p className="text-base break-words">{order.shipper.address}</p>
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <p>Phone: {order.shipper.phone}</p>
                  {order.shipper.phone2 && <p>Phone 2: {order.shipper.phone2}</p>}
                </div>
              </div>
            </div>
            <div className="border-2 border-gray-800 p-4">
              <h2 className="font-bold text-lg mb-3">TO: CONSIGNEE</h2>
              <div className="space-y-1 text-base min-w-[280px]">
                <p className="font-semibold mb-2">{order.consignee.name}</p>
                <p className="text-base break-words">{order.consignee.address}</p>
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <p>Phone: {order.consignee.phone}</p>
                  {order.consignee.phone2 && <p>Phone 2: {order.consignee.phone2}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="flex-1">
            <Table>
              <TableHeader>
                <TableRow className="border-t-2 border-x-2 border-gray-800">
                  <TableHead className="text-base font-bold py-3 text-black">Number of Packages</TableHead>
                  <TableHead className="text-base font-bold py-3 text-black">Description</TableHead>
                  <TableHead className="text-base font-bold py-3 text-black">Weight</TableHead>
                  <TableHead className="text-base font-bold py-3 text-black">Total Charges</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allItems.map((item, index) => (
                  <TableRow key={index} className="border-x-2 border-gray-800">
                    <TableCell className="text-base py-3 px-2">
                      <Input
                        type="number"
                        value={item.packages || ""}
                        onChange={(e) => handleItemChange(index, "packages", e.target.value)}
                        className="border-0 p-0 h-auto text-base"
                      />
                    </TableCell>
                    <TableCell className="text-base py-3 px-2">
                      <Input
                        type="text"
                        value={item.description || ""}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="border-0 p-0 h-auto text-base"
                      />
                    </TableCell>
                    <TableCell className="text-base py-3 px-2">
                      <Input
                        type="number"
                        value={item.weight || ""}
                        onChange={(e) => handleItemChange(index, "weight", e.target.value)}
                        className="border-0 p-0 h-auto text-base"
                      />
                    </TableCell>
                    <TableCell className="text-base py-3 px-2">
                      <Input
                        type="number"
                        value={item.charges || ""}
                        onChange={(e) => handleItemChange(index, "charges", e.target.value)}
                        className="border-0 p-0 h-auto text-base"
                        prefix="$"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Spacer to push signatures to bottom */}
          <div className="flex-grow min-h-[1in]" />

          {/* Signature Section */}
          <div className="flex flex-col gap-4 w-72 mt-4">
            <div>
              <div className="border-b-2 border-black pt-6">
                <Input
                  type="text"
                  value={signatures.pickedUpBy}
                  onChange={(e) => handleSignatureChange("pickedUpBy", e.target.value)}
                  placeholder="Picked Up By"
                  className="border-0 p-0 h-auto text-base font-bold"
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
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
              <div className="border-b-2 border-black pt-6">
                <Input
                  type="text"
                  value={signatures.deliveredBy}
                  onChange={(e) => handleSignatureChange("deliveredBy", e.target.value)}
                  placeholder="Delivered By"
                  className="border-0 p-0 h-auto text-base font-bold"
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
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
              <div className="border-b-2 border-black pt-6">
                <Input
                  type="text"
                  value={signatures.receivedBy}
                  onChange={(e) => handleSignatureChange("receivedBy", e.target.value)}
                  placeholder="Received By"
                  className="border-0 p-0 h-auto text-base font-bold"
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
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