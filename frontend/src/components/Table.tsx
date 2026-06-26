import {
  DataGrid,
  type GridAlignment,
  type GridColDef,
  type GridRowSelectionModel,
  gridClasses,
} from "@mui/x-data-grid";
import { alpha, styled } from "@mui/material/styles";
import { Box, Typography, useMediaQuery } from "@mui/material";

import { ptBR } from "@mui/x-data-grid/locales";
// import RemoveBtn from "./RemoveBtn";
// import EditBtn from "./EditBtn";

interface ColumnOptions {
  align?: "left" | "center" | "right";
  headerAlign?: "left" | "center" | "right";
}

interface TableProps {
  values: any[];
  hideIdColumn?: boolean;
  hasInLineEditing?: boolean;
  hasInlineExclusion?: boolean;
  multipleRows?: boolean;
  hideFooter?: boolean;
  catchIdFromTable?: (id: number) => void;
  onRowClick?: (id: number) => void;
  pageSize?: string;
  noPagination?: boolean;
  rowHeight?: number;
  checkboxSelection?: boolean;
  handleSelectionChange?: (items: GridRowSelectionModel) => void;
  disableRowSelectionOnClick?: boolean;
  headerExpanded?: boolean;
  customWidth?: boolean;
  catchRowValues?: (row: any) => void;
  selectedId?: number;
  columnOptions?: Record<string, ColumnOptions>;
  idField?: string;
}

const shortenHeader = (header: string): string => {
  const prefixes = ["Quantidade de", "Nome da"];

  for (const prefix of prefixes) {
    if (header.startsWith(prefix)) {
      return header.replace(prefix, "").trim();
    }
  }

  if (header.length > 15) {
    const words = header.split(" ");
    return words.slice(-2).join(" ");
  }

  return header;
};

const ODD_OPACITY = 0.5;
const darker = 0.7;

const StripedDataGrid = styled(DataGrid)(({ theme }) => ({
  '.MuiDataGrid-root .MuiDataGrid-booleanCell[data-value="true"]': {
    color: "#6ef06b",
  },
  '.MuiDataGrid-root .MuiDataGrid-booleanCell[data-value="false"]': {
    color: "#ff3c3c",
  },
  [`& .${gridClasses.row}.odd`]: {
    backgroundColor: alpha("#fff6f7", 0.9),
    "&:hover, &.Mui-hovered": {
      backgroundColor: alpha("#fed2d5", darker),
      "@media (hover: none)": {
        backgroundColor: "transparent",
      },
    },
    "&.Mui-selected": {
      backgroundColor: alpha("#fed2d5", darker),
      color: "black",
      "&:hover, &.Mui-hovered": {
        backgroundColor: alpha(
          "#fed2d5",
          darker +
            theme.palette.action.selectedOpacity +
            theme.palette.action.hoverOpacity,
        ),
        "@media (hover: none)": {
          backgroundColor: alpha(
            theme.palette.primary.main,
            ODD_OPACITY + theme.palette.action.selectedOpacity,
          ),
        },
      },
    },
  },

  [`& .${gridClasses.row}.even`]: {
    "&:hover, &.Mui-hovered": {
      backgroundColor: alpha("#fed2d5", darker),
      "@media (hover: none)": {
        backgroundColor: "transparent",
      },
    },
    "&.Mui-selected": {
      backgroundColor: alpha("#fed2d5", darker),
      color: "black",
      "&:hover, &.Mui-hovered": {
        backgroundColor: alpha(
          "#fed2d5",
          darker +
            theme.palette.action.selectedOpacity +
            theme.palette.action.hoverOpacity,
        ),
        "@media (hover: none)": {
          backgroundColor: alpha(
            theme.palette.primary.main,
            ODD_OPACITY + theme.palette.action.selectedOpacity,
          ),
        },
      },
    },
  },

  [`& .${gridClasses.cell}:focus, & .${gridClasses.cell}:focus-within`]: {
    outline: "none",
  },
}));

const resolveColType = (value: unknown): GridColDef["type"] => {
  switch (typeof value) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    default:
      return "string";
  }
};

export default function Table(props: TableProps) {
  if (!props.values || props.values.length === 0) {
    return (
      <Typography
        variant="body1"
        sx={{
          textAlign: "left",
          padding: "20px",
          color: "gray",
          fontSize: { xs: "15px", sm: "20px" },
        }}
      >
        Nenhum registro encontrado.
      </Typography>
    );
  }
  const chavesCorretas: string[] = Object.keys(props.values[0]);
  const allKeys = Object.values(props.values[0]);

  const isMobile = useMediaQuery("(max-width: 600px)");

  const columns: GridColDef[] = [];

  chavesCorretas.map((chave, index) => {
    let flexValue = 1;
    if (index === 0) {
      flexValue = 0;
    }

    const alignment = props.columnOptions?.[chave]?.align || "left";
    const headerAlignment =
      props.columnOptions?.[chave]?.headerAlign || "left";

    const obj: GridColDef = {
      headerAlign: headerAlignment,
      align: alignment,
      field: chave,
      width: 120,
      type: resolveColType(allKeys[index]),
      flex: flexValue,
      headerName: isMobile ? shortenHeader(chave) : chave,
      minWidth: 120,
    };

    columns.push(obj);
  });
  if (props.hasInLineEditing || props.hasInlineExclusion) {
    const attachColumn: GridColDef = {
      field: "actions",
      headerName: "Ações",
      width: 100,
      headerAlign: "center" as GridAlignment,
      align: "center" as GridAlignment,
      renderCell: () => (
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            padding: 8,
          }}
        >
          {/* {props.hasInLineEditing && (
            <EditBtn
              rowData={params.row}
              handleInlineEdit={props.handleInlineEdit}
            />
          )} */}
          {/* {props.hasInlineExclusion && <RemoveBtn props={props} />} */}
        </div>
      ),
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
    };

    columns.push(attachColumn);
  }

  return (
    <Box
      sx={{
        width: "100%",
        overflowX: "auto",
        // maxHeight: "80vh",
        overflowY: "auto",
      }}
    >
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflowX: "auto",
        }}
      >
        <StripedDataGrid
          localeText={ptBR.components.MuiDataGrid.defaultProps.localeText}
          density="compact"
          getRowId={(row) => row[props.idField || "id"]}
          onRowClick={(e) => {
            if (props.catchIdFromTable) props.catchIdFromTable(e.id as number);
            if (props.catchRowValues) props.catchRowValues(e.row);
            if (props.onRowClick) props.onRowClick(e.id as number);
          }}
          rows={props.values}
          rowHeight={props.rowHeight ? props.rowHeight : 60.5}
          columns={columns.map((column) => ({
            ...column,
            width: column.width,
          }))}
          pagination
          initialState={{
            pagination: {
              paginationModel: {
                page: 0,
                pageSize: 5,
              },
            },
            columns: {
              columnVisibilityModel: {
                idUsuario: false,
                id: props.hideIdColumn ? false : true,
              },
            },
          }}
          pageSizeOptions={props.noPagination ? [] : [5, 10, 20, 50]}
          getRowClassName={(params) =>
            params.indexRelativeToCurrentPage % 2 === 0 ? "even" : "odd"
          }
          checkboxSelection={props.checkboxSelection}
          onRowSelectionModelChange={(item) =>
            props.handleSelectionChange && props.handleSelectionChange(item)
          }
          disableMultipleRowSelection={props.multipleRows ? false : true}
          disableRowSelectionOnClick={props.disableRowSelectionOnClick}
          columnHeaderHeight={props.headerExpanded ? 70 : 56}
          hideFooter={props.hideFooter ? true : false}
        />
      </Box>
    </Box>
  );
}
