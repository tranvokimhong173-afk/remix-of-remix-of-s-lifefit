import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataRow {
  timestamp: string;
  position: string;
  heartRate: number;
  temperature: number;
  spo2: number;
}

interface DataHistoryTableProps {
  data: DataRow[];
}

const DataHistoryTable = ({ data }: DataHistoryTableProps) => {
  return (
    <div className="w-full rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center shadow-lg">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-blue-400 bg-clip-text text-transparent">
              Lịch sử dữ liệu
            </h2>
            <p className="text-sm text-muted-foreground">Bảng dữ liệu lịch sử chi tiết</p>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Thời gian</TableHead>
              <TableHead className="font-semibold">Vị trí</TableHead>
              <TableHead className="font-semibold">Nhịp tim</TableHead>
              <TableHead className="font-semibold">SpO2</TableHead>
              <TableHead className="font-semibold">Nhiệt độ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Chưa có dữ liệu lịch sử
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{row.timestamp}</TableCell>
                  <TableCell className="text-muted-foreground">{row.position}</TableCell>
                  <TableCell>
                    <span className="text-primary font-semibold">{row.heartRate} bpm</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-blue-500 font-semibold">{row.spo2}%</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.temperature} °C</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default DataHistoryTable;
