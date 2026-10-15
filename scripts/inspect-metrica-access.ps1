param(
  [Parameter(Mandatory=$true)][string]$DatabasePath,
  [switch]$IncludeAllRows
)

$ErrorActionPreference = "Stop"
$connection = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$DatabasePath;Mode=Read;")

function Invoke-Scalar([string]$Sql) {
  $command = $connection.CreateCommand()
  $command.CommandText = $Sql
  return $command.ExecuteScalar()
}

function Invoke-Rows([string]$Sql) {
  $command = $connection.CreateCommand()
  $command.CommandText = $Sql
  $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($command)
  $table = New-Object System.Data.DataTable
  [void]$adapter.Fill($table)
  $rows = @()
  foreach ($row in $table.Rows) {
    $item = [ordered]@{}
    foreach ($column in $table.Columns) {
      $value = $row[$column.ColumnName]
      $item[$column.ColumnName] = if ($value -is [DBNull]) { $null } else { $value }
    }
    $rows += [pscustomobject]$item
  }
  return $rows
}

function Count-Blank([string]$Table, [string]$Column) {
  return [int](Invoke-Scalar "SELECT COUNT(*) FROM [$Table] WHERE [$Column] IS NULL OR Trim([$Column] & '') = ''")
}

function Count-DuplicateGroups([string]$Table, [string]$Column) {
  $sql = "SELECT COUNT(*) FROM (SELECT [$Column] FROM [$Table] WHERE [$Column] IS NOT NULL AND Trim([$Column] & '') <> '' GROUP BY [$Column] HAVING COUNT(*) > 1)"
  try { return [int](Invoke-Scalar $sql) } catch { return 0 }
}

$connection.Open()
try {
  $tableSchema = $connection.GetSchema("Tables") | Where-Object { $_.TABLE_TYPE -eq "TABLE" } | Sort-Object TABLE_NAME
  $tables = @()
  foreach ($tableInfo in $tableSchema) {
    $tableName = $tableInfo.TABLE_NAME
    $restrictions = New-Object string[] 4
    $restrictions[2] = $tableName
    $columns = @($connection.GetSchema("Columns", $restrictions) | Sort-Object ORDINAL_POSITION | ForEach-Object {
      [pscustomobject]@{
        name = $_.COLUMN_NAME
        dataType = [int]$_.DATA_TYPE
        nullable = [bool]$_.IS_NULLABLE
        maxLength = if ($_.CHARACTER_MAXIMUM_LENGTH -is [DBNull]) { $null } else { [int]$_.CHARACTER_MAXIMUM_LENGTH }
      }
    })
    $tableResult = [ordered]@{
      name = $tableName
      count = [int](Invoke-Scalar "SELECT COUNT(*) FROM [$tableName]")
      columns = $columns
      preview = @(Invoke-Rows "SELECT TOP 5 * FROM [$tableName]")
    }
    if ($IncludeAllRows) { $tableResult.records = @(Invoke-Rows "SELECT * FROM [$tableName]") }
    $tables += [pscustomobject]$tableResult
  }

  $relationships = @(
    [pscustomobject]@{ from="CadMatricula.CodigoImovel"; to="CadImovel.CodigoImovel"; recovered=[int](Invoke-Scalar "SELECT COUNT(*) FROM CadMatricula AS m INNER JOIN CadImovel AS i ON m.CodigoImovel=i.CodigoImovel"); orphaned=[int](Invoke-Scalar "SELECT COUNT(*) FROM CadMatricula AS m LEFT JOIN CadImovel AS i ON m.CodigoImovel=i.CodigoImovel WHERE m.CodigoImovel IS NOT NULL AND i.CodigoImovel IS NULL") },
    [pscustomobject]@{ from="CadProprietario.CodigoImovel"; to="CadImovel.CodigoImovel"; recovered=[int](Invoke-Scalar "SELECT COUNT(*) FROM CadProprietario AS p INNER JOIN CadImovel AS i ON p.CodigoImovel=i.CodigoImovel"); orphaned=[int](Invoke-Scalar "SELECT COUNT(*) FROM CadProprietario AS p LEFT JOIN CadImovel AS i ON p.CodigoImovel=i.CodigoImovel WHERE p.CodigoImovel IS NOT NULL AND i.CodigoImovel IS NULL") },
    [pscustomobject]@{ from="CadServico.CodigoCliente"; to="CadCliente.Codigo_Cliente"; recovered=[int](Invoke-Scalar "SELECT COUNT(*) FROM CadServico AS s INNER JOIN CadCliente AS c ON Val(s.CodigoCliente)=c.Codigo_Cliente"); orphaned=[int](Invoke-Scalar "SELECT COUNT(*) FROM CadServico AS s LEFT JOIN CadCliente AS c ON Val(s.CodigoCliente)=c.Codigo_Cliente WHERE Trim(s.CodigoCliente & '') <> '' AND c.Codigo_Cliente IS NULL") }
  )

  $issues = @(
    [pscustomobject]@{ table="CadCliente"; field="Nome/Razao_Social"; kind="EMPTY"; count=[int](Invoke-Scalar "SELECT COUNT(*) FROM CadCliente WHERE Trim(Nome & '')='' AND Trim(Razao_Social & '')=''") },
    [pscustomobject]@{ table="CadImovel"; field="NomeImovel"; kind="EMPTY"; count=(Count-Blank "CadImovel" "NomeImovel") },
    [pscustomobject]@{ table="CadMatricula"; field="CodigoImovel"; kind="EMPTY"; count=[int](Invoke-Scalar "SELECT COUNT(*) FROM CadMatricula WHERE CodigoImovel IS NULL") },
    [pscustomobject]@{ table="CadMatricula"; field="Numero"; kind="EMPTY"; count=(Count-Blank "CadMatricula" "Numero") },
    [pscustomobject]@{ table="CadProprietario"; field="CodigoImovel"; kind="EMPTY"; count=[int](Invoke-Scalar "SELECT COUNT(*) FROM CadProprietario WHERE CodigoImovel IS NULL") },
    [pscustomobject]@{ table="CadProprietario"; field="NomeProp"; kind="EMPTY"; count=(Count-Blank "CadProprietario" "NomeProp") },
    [pscustomobject]@{ table="CadServico"; field="CodigoCliente"; kind="EMPTY"; count=(Count-Blank "CadServico" "CodigoCliente") },
    [pscustomobject]@{ table="CadCliente"; field="CPF"; kind="DUPLICATE_GROUP"; count=(Count-DuplicateGroups "CadCliente" "CPF") },
    [pscustomobject]@{ table="CadCliente"; field="CNPJ"; kind="DUPLICATE_GROUP"; count=(Count-DuplicateGroups "CadCliente" "CNPJ") },
    [pscustomobject]@{ table="CadImovel"; field="NomeImovel"; kind="DUPLICATE_GROUP"; count=(Count-DuplicateGroups "CadImovel" "NomeImovel") },
    [pscustomobject]@{ table="CadProprietario"; field="CPF_CIC"; kind="DUPLICATE_GROUP"; count=(Count-DuplicateGroups "CadProprietario" "CPF_CIC") }
  )

  $result = [ordered]@{
    source = "METRICA_TOPO_MDB"
    file = [System.IO.Path]::GetFileName($DatabasePath)
    analyzedAt = (Get-Date).ToString("o")
    tables = $tables
    relationships = $relationships
    issues = $issues
    totals = [ordered]@{
      tables = $tables.Count
      records = [int](($tables | Measure-Object count -Sum).Sum)
      recoveredRelationships = [int](($relationships | Measure-Object recovered -Sum).Sum)
      orphanedRelationships = [int](($relationships | Measure-Object orphaned -Sum).Sum)
      incomplete = [int](($issues | Where-Object kind -eq "EMPTY" | Measure-Object count -Sum).Sum)
      duplicateGroups = [int](($issues | Where-Object kind -eq "DUPLICATE_GROUP" | Measure-Object count -Sum).Sum)
    }
  }
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $result | ConvertTo-Json -Depth 10 -Compress
} finally {
  $connection.Close()
}
