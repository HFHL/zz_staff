// ArrayBuffer转16进制字符串
export function ab2hex(buffer) {
  const hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function(bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('')
}

// 16进制字符串转ArrayBuffer
export function hexStringToArrayBuffer(str) {
  if (!str) return new ArrayBuffer(0)
  const buffer = new ArrayBuffer(str.length / 2)
  const dataView = new DataView(buffer)
  let ind = 0
  for (let i = 0; i < str.length; i += 2) {
    dataView.setUint8(ind, parseInt(str.substr(i, 2), 16))
    ind++
  }
  return buffer
}

// 字符串转ArrayBuffer
export function string2ArrayBuffer(str) {
  const buffer = new ArrayBuffer(str.length)
  const dataView = new DataView(buffer)
  for (let i = 0; i < str.length; i++) {
    dataView.setUint8(i, str.charCodeAt(i))
  }
  return buffer
}

// ArrayBuffer转字符串
export function arrayBuffer2String(buffer) {
  return String.fromCharCode.apply(null, new Uint8Array(buffer))
}

// 生成打印命令
export function generatePrintCommand(printItem) {
  const { type, content, size = 1, align = 'left' } = printItem
  let command = ''

  // 设置对齐方式
  switch (align) {
    case 'center':
      command += '1B6101' // ESC a 1
      break
    case 'right':
      command += '1B6102' // ESC a 2
      break
    default:
      command += '1B6100' // ESC a 0 (左对齐)
      break
  }

  // 设置字体大小
  if (size > 1) {
    command += '1D2100' // GS ! 0
  }

  // 添加内容
  switch (type) {
    case 'text':
      command += string2Hex(content)
      command += '0A' // 换行
      break
    case 'barcode':
      // 根据实际打印机协议实现条码打印命令
      break
    case 'qrcode':
      // 根据实际打印机协议实现二维码打印命令
      break
  }

  return command
}

// 生成走纸命令
export function generateFeedCommand(lines = 3) {
  return '1B64' + lines.toString(16).padStart(2, '0') // ESC d n
}

// 字符串转16进制
function string2Hex(str) {
  let hex = ''
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0')
  }
  return hex
}
