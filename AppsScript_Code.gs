/**
 * 영어 문장 암기 앱 - Google Apps Script 웹앱
 *
 * 이 스크립트는 스프레드시트의 "탭 하나당 단어장 하나"로 취급합니다.
 * 탭(워크시트)을 새로 추가하면 그 탭 이름이 곧 단어장 이름이 됩니다.
 * 각 탭의 헤더(1행)는 아래 컬럼을 (순서 무관, 헤더 텍스트로 인식) 포함해야 합니다.
 *   날짜 | 표현(영어) | 내 대사(한글) | Details (부가설명)
 * "학습로그" 탭은 예약된 이름으로, 단어장 데이터로 취급하지 않습니다.
 * 헤더에 표현/영어 또는 대사/한글 컬럼이 인식되지 않는 탭은 단어장이 아닌 것으로 보고 건너뜁니다.
 *
 * 학습 로그는 "학습로그" 라는 탭에 자동으로 만들어집니다 (없으면 새로 생성).
 *
 * 설치 방법:
 * 1. 이 시트에서 메뉴 [확장 프로그램] > [Apps Script] 를 엽니다.
 * 2. 기본 Code.gs 내용을 모두 지우고 이 파일의 내용을 붙여넣습니다.
 * 3. 우측 상단 [배포] > [새 배포] > 유형: "웹 앱" 선택
 *    - 실행 사용자: 나
 *    - 액세스 권한: "모든 사용자" (또는 "Google 계정이 있는 모든 사용자")
 * 4. 배포 후 나오는 웹앱 URL(.../exec)을 복사해서 PWA 앱의 설정 화면에 입력합니다.
 *
 * 엔드포인트:
 *   GET  ?action=sentences        -> 문장 데이터 전체 반환 (모든 단어장 탭 통합)
 *   GET  ?action=logs             -> 학습 로그 전체 반환 (선택)
 *   GET  ?action=debug            -> 탭별 인식 상태 진단 (단어장이 안 보일 때 확인용)
 *   POST { action: "addLog", ... }      -> 학습 로그 1건 추가
 *   POST { action: "addLogsBatch", ... } -> 학습 로그 여러 건 일괄 추가
 *   POST { action: "addSentence", ... }  -> 새 문장 1건 추가 (deck 이름의 탭이 없으면 새로 생성)
 *   POST { action: "updateSentence", id, deck, english, korean, detail } -> 기존 문장 수정 (deck이 바뀌면 다른 탭으로 이동)
 *   POST { action: "addDeck", deck }     -> 문장 없이 빈 단어장(탭)만 생성 (이미 있으면 그대로 둠)
 *   POST { action: "deleteDeck", deck }  -> 단어장(탭) 전체 삭제 (그 안의 문장도 모두 사라짐)
 *   POST { action: "deleteSentence", id } -> 문장 1건 삭제 (해당 탭의 행을 삭제)
 */

var SHEET_LOGS = "학습로그";
var LOG_HEADERS = ["timestamp", "sentenceId", "단어장", "사용자입력", "정답여부", "유사도"];
var RESERVED_SHEETS = [SHEET_LOGS];
var SENTENCE_HEADERS = ["날짜", "표현(영어)", "내 대사(한글)", "Details (부가설명)"];

// 문장 데이터 시트의 헤더 텍스트를 인식하기 위한 키워드 (이 중 하나라도 포함되면 매칭)
var COLUMN_KEYWORDS = {
  date: ["날짜"],
  english: ["표현", "영어"],
  korean: ["대사", "한글"],
  detail: ["Details", "부가", "설명"]
};

function doGet(e) {
  var action = e.parameter.action || "sentences";

  if (action === "sentences") {
    return jsonResponse(getSentences());
  } else if (action === "logs") {
    return jsonResponse(getLogs());
  } else if (action === "debug") {
    return jsonResponse(getDebugInfo());
  }

  return jsonResponse({ error: "unknown action" });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ error: "invalid JSON body" });
  }

  var action = body.action;

  if (action === "addLog") {
    return jsonResponse(addLog(body));
  } else if (action === "addLogsBatch") {
    return jsonResponse(addLogsBatch(body.logs || []));
  } else if (action === "addSentence") {
    return jsonResponse(addSentence(body));
  } else if (action === "updateSentence") {
    return jsonResponse(updateSentence(body));
  } else if (action === "addDeck") {
    return jsonResponse(addDeck(body));
  } else if (action === "deleteDeck") {
    return jsonResponse(deleteDeck(body));
  } else if (action === "deleteSentence") {
    return jsonResponse(deleteSentence(body));
  }

  return jsonResponse({ error: "unknown action" });
}

/* ---------- 문장 데이터 읽기 (탭 = 단어장) ---------- */

function getSentenceSheets() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(function (sheet) {
    return RESERVED_SHEETS.indexOf(sheet.getName()) === -1;
  });
}

function findColumnIndex(headers, keywords) {
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || "");
    for (var k = 0; k < keywords.length; k++) {
      if (header.indexOf(keywords[k]) !== -1) return i;
    }
  }
  return -1;
}

function getSentenceColumns(headers) {
  return {
    date: findColumnIndex(headers, COLUMN_KEYWORDS.date),
    english: findColumnIndex(headers, COLUMN_KEYWORDS.english),
    korean: findColumnIndex(headers, COLUMN_KEYWORDS.korean),
    detail: findColumnIndex(headers, COLUMN_KEYWORDS.detail)
  };
}

// 날짜 형식 셀은 getValues()에서 Date 객체로 오는데, 이를 그대로 JSON으로 보내면
// UTC ISO 문자열로 직렬화되면서 시간대 차이로 날짜가 하루 밀리는 문제가 생긴다.
// 항상 스프레드시트 시간대 기준 "yyyy-MM-dd" 문자열로 고정해서 내보낸다.
function formatDateValue(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(value, tz, "yyyy-MM-dd");
  }
  return value;
}

function getSentences() {
  var rows = [];
  var decks = [];

  getSentenceSheets().forEach(function (sheet) {
    var deckName = sheet.getName();
    decks.push(deckName); // 예약 탭(학습로그)이 아니면 내용이 비어 있어도 단어장으로 인식

    var data = sheet.getDataRange().getValues();
    if (data.length < 1) return;

    var headers = data[0];
    var col = getSentenceColumns(headers);
    if (col.english === -1 && col.korean === -1) return; // 헤더 인식이 안 되면 문장만 못 읽음 (단어장 자체는 목록에 남음)

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var english = col.english !== -1 ? row[col.english] : "";
      var korean = col.korean !== -1 ? row[col.korean] : "";
      if (!english && !korean) continue; // 빈 행 스킵

      rows.push({
        id: deckName + "!" + i, // 탭별 행 번호를 합쳐 전체 고유 id로 사용
        date: col.date !== -1 ? formatDateValue(row[col.date]) : "",
        english: english,
        korean: korean,
        detail: col.detail !== -1 ? row[col.detail] : "",
        deck: deckName
      });
    }
  });

  return { sentences: rows, count: rows.length, decks: decks };
}

/* ---------- 새 문장 추가 ---------- */

function addSentence(body) {
  var deckName = (body.deck && String(body.deck).trim()) || "기본";
  var sheet = getOrCreateSheet(deckName, SENTENCE_HEADERS);

  var data = sheet.getDataRange().getValues();
  var headers = data.length ? data[0] : SENTENCE_HEADERS;

  var col = getSentenceColumns(headers);
  var row = new Array(headers.length).fill("");
  if (col.date !== -1) row[col.date] = body.date || new Date().toISOString();
  if (col.english !== -1) row[col.english] = body.english || "";
  if (col.korean !== -1) row[col.korean] = body.korean || "";
  if (col.detail !== -1) row[col.detail] = body.detail || "";

  sheet.appendRow(row);
  return { ok: true, id: deckName + "!" + (sheet.getLastRow() - 1) };
}

/* ---------- 빈 단어장(탭) 생성 ---------- */

function addDeck(body) {
  var deckName = body.deck && String(body.deck).trim();
  if (!deckName) return { ok: false, error: "deck name required" };
  if (RESERVED_SHEETS.indexOf(deckName) !== -1) return { ok: false, error: "reserved deck name" };

  getOrCreateSheet(deckName, SENTENCE_HEADERS);
  return { ok: true };
}

/* ---------- 단어장(탭) 전체 삭제 ---------- */

function deleteDeck(body) {
  var deckName = body.deck && String(body.deck).trim();
  if (!deckName) return { ok: false, error: "deck name required" };
  if (RESERVED_SHEETS.indexOf(deckName) !== -1) return { ok: false, error: "reserved deck name" };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(deckName);
  if (!sheet) return { ok: true }; // 이미 없으면 성공으로 처리 (재시도 시 멱등)
  if (ss.getSheets().length <= 1) return { ok: false, error: "마지막 남은 탭은 삭제할 수 없습니다" };

  ss.deleteSheet(sheet);
  return { ok: true };
}

/* ---------- 문장 수정 ---------- */

// id는 "탭이름!행번호(헤더 제외, 데이터 기준)" 형태
function parseSentenceId(id) {
  var str = String(id || "");
  var idx = str.lastIndexOf("!");
  if (idx === -1) return null;
  var row = parseInt(str.substring(idx + 1), 10);
  if (isNaN(row)) return null;
  return { deck: str.substring(0, idx), row: row };
}

function updateSentence(body) {
  var ref = parseSentenceId(body.id);
  if (!ref) return { ok: false, error: "invalid id" };

  var oldSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ref.deck);
  if (!oldSheet) return { ok: false, error: "sheet not found: " + ref.deck };

  var sheetRow = ref.row + 1; // 헤더 보정 (데이터 행 -> 실제 시트 행)
  var newDeckName = (body.deck && String(body.deck).trim()) || ref.deck;

  if (newDeckName === ref.deck) {
    var headers = oldSheet.getRange(1, 1, 1, oldSheet.getLastColumn()).getValues()[0];
    var col = getSentenceColumns(headers);
    if (col.english !== -1) oldSheet.getRange(sheetRow, col.english + 1).setValue(body.english || "");
    if (col.korean !== -1) oldSheet.getRange(sheetRow, col.korean + 1).setValue(body.korean || "");
    if (col.detail !== -1) oldSheet.getRange(sheetRow, col.detail + 1).setValue(body.detail || "");
    return { ok: true, id: body.id };
  }

  // 단어장(탭)이 바뀐 경우: 기존 행은 삭제하고 새 탭에 추가
  oldSheet.deleteRow(sheetRow);
  return addSentence({
    deck: newDeckName,
    english: body.english,
    korean: body.korean,
    detail: body.detail,
    date: body.date
  });
}

/* ---------- 문장 삭제 ---------- */

function deleteSentence(body) {
  var ref = parseSentenceId(body.id);
  if (!ref) return { ok: false, error: "invalid id" };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ref.deck);
  if (!sheet) return { ok: false, error: "sheet not found: " + ref.deck };

  sheet.deleteRow(ref.row + 1); // 헤더 보정 (데이터 행 -> 실제 시트 행)
  return { ok: true };
}

/* ---------- 단어장 인식 상태 진단 ---------- */

function getDebugInfo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets().map(function (sheet) {
    var name = sheet.getName();
    if (RESERVED_SHEETS.indexOf(name) !== -1) {
      return { name: name, reserved: true };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data.length ? data[0] : [];
    var col = getSentenceColumns(headers);

    return {
      name: name,
      headers: headers,
      recognizedColumns: col,
      recognizedAsDeck: !(col.english === -1 && col.korean === -1),
      dataRowCount: Math.max(data.length - 1, 0)
    };
  });

  return { sheets: sheets };
}

/* ---------- 학습 로그 읽기 ---------- */

function getLogs() {
  var sheet = getOrCreateSheet(SHEET_LOGS, LOG_HEADERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row.every(function (c) { return c === ""; })) continue;

    var item = {};
    for (var j = 0; j < headers.length; j++) {
      item[headers[j]] = row[j];
    }
    rows.push(item);
  }

  return { logs: rows, count: rows.length };
}

/* ---------- 학습 로그 1건 추가 ---------- */

function addLog(body) {
  var sheet = getOrCreateSheet(SHEET_LOGS, LOG_HEADERS);

  sheet.appendRow([
    body.timestamp || new Date().toISOString(),
    body.sentenceId || "",
    body.deck || "",
    body.userInput || "",
    body.isCorrect === true ? "TRUE" : (body.isCorrect === false ? "FALSE" : ""),
    body.similarity != null ? body.similarity : ""
  ]);

  return { ok: true };
}

/* ---------- 학습 로그 여러 건 일괄 추가 (오프라인 동기화용) ---------- */

function addLogsBatch(logs) {
  if (!logs.length) return { ok: true, added: 0 };

  var sheet = getOrCreateSheet(SHEET_LOGS, LOG_HEADERS);
  var rows = logs.map(function (body) {
    return [
      body.timestamp || new Date().toISOString(),
      body.sentenceId || "",
      body.deck || "",
      body.userInput || "",
      body.isCorrect === true ? "TRUE" : (body.isCorrect === false ? "FALSE" : ""),
      body.similarity != null ? body.similarity : ""
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  return { ok: true, added: rows.length };
}

/* ---------- 유틸 ---------- */

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
