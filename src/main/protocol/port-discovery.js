/**
 * @module protocol/port-discovery
 * @description Windows COM 端口枚举。通过注册表、WMI 和批量探测发现可用串口。
 * @author EternoPax
 * @version 1.0.0
 */

import { SerialPort } from "serialport";
import { execFile } from "child_process";

/**
 * 执行 PowerShell 脚本并返回标准输出。
 * @param {string} script
 * @returns {Promise<string>}
 */
function runPowerShell(script) {
  return new Promise((resolve) => {
    execFile("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 8000 }, (error, stdout) => {
      resolve(error ? "" : (stdout || ""));
    });
  });
}

/**
 * 探测指定 COM 端口是否存在。
 * @param {string} comPort
 * @returns {Promise<boolean>}
 */
function probeComPort(comPort) {
  return new Promise((resolve) => {
    execFile("mode", [comPort], { timeout: 1000 }, (error) => {
      resolve(!error);
    });
  });
}

/**
 * 通过注册表和 WMI 探测额外的 COM 端口（蓝牙等）。
 * @param {Function} logFn - 日志回调
 * @returns {Promise<Array>}
 */
async function listExtraComPorts(logFn) {
  if (process.platform !== "win32") return [];

  const candidateNumbers = new Set();

  const regOut = await new Promise((resolve) => {
    execFile("reg", ["query", "HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM"], { timeout: 5000 }, (err, stdout) => resolve(err ? "" : stdout));
  });
  for (const line of regOut.split("\n")) {
    const m = line.match(/COM(\d+)/i);
    if (m) candidateNumbers.add(parseInt(m[1], 10));
  }

  const wmiOut = await runPowerShell(
    `Get-CimInstance -ClassName Win32_SerialPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty DeviceID`
  );
  for (const line of wmiOut.split("\n")) {
    const m = line.match(/COM(\d+)/i);
    if (m) candidateNumbers.add(parseInt(m[1], 10));
  }

  const pnpOut = await runPowerShell(
    `Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | ` +
    `Where-Object { $_.Name -match 'COM\\d+' -and ($_.Name -match 'luetooth' -or $_.Name -match 'Bth' -or $_.Name -match 'SPP' -or $_.Name -match 'Serial') } | ` +
    `Select-Object -ExpandProperty Name`
  );
  for (const line of pnpOut.split("\n")) {
    const m = line.match(/COM(\d+)/i);
    if (m) candidateNumbers.add(parseInt(m[1], 10));
  }

  for (let i = 1; i <= 30; i++) candidateNumbers.add(i);

  const allNumbers = Array.from(candidateNumbers).sort((a, b) => a - b);
  logFn(`正在探测 ${allNumbers.length} 个候选 COM 端口...`);

  const existingPorts = new Set();
  const batchSize = 16;
  for (let i = 0; i < allNumbers.length; i += batchSize) {
    const batch = allNumbers.slice(i, i + batchSize);
    const probes = await Promise.all(
      batch.map(async (num) => ({ num, exists: await probeComPort(`COM${num}`) }))
    );
    for (const { num, exists } of probes) {
      if (exists) existingPorts.add(num);
    }
  }

  const ports = Array.from(existingPorts).map(num => ({
    path: `COM${num}`, manufacturer: "", friendlyName: `COM${num}`,
    vendorId: "", productId: "", pnpId: "", source: "probe"
  }));

  logFn(`探测完成，发现 ${ports.length} 个可用 COM 端口`);
  return ports;
}

/**
 * 合并标准串口列表和额外探测到的端口。
 * @param {Function} logFn
 * @returns {Promise<Array>}
 */
export async function listPorts(logFn) {
  const [serialPorts, extraPorts] = await Promise.all([
    SerialPort.list(),
    listExtraComPorts(logFn)
  ]);

  logFn(`系统检测到 ${serialPorts.length} 个标准串口设备`);
  serialPorts.forEach(p => logFn(`  - ${p.path} | ${p.manufacturer || '未知'} | ${p.friendlyName || ''}`));

  const seenPaths = new Set();
  const merged = [];

  for (const port of serialPorts) {
    const mapped = {
      path: port.path,
      manufacturer: port.manufacturer || "",
      friendlyName: [port.path, port.manufacturer, port.vendorId, port.productId].filter(Boolean).join("  "),
      vendorId: port.vendorId,
      productId: port.productId,
      pnpId: port.pnpId
    };
    seenPaths.add(mapped.path.toUpperCase());
    merged.push(mapped);
  }

  let addedCount = 0;
  for (const ep of extraPorts) {
    if (!seenPaths.has(ep.path.toUpperCase())) {
      seenPaths.add(ep.path.toUpperCase());
      merged.push(ep);
      addedCount++;
    }
  }

  if (addedCount > 0) logFn(`额外发现 ${addedCount} 个串口（蓝牙/其他）`);
  return merged.sort((a, b) => a.path.localeCompare(b.path));
}
