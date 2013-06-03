
function stripHTML(html) {
  var tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent||tmp.innerText;
}

function pickRandom(items) {
  return items[Math.floor( Math.random()*items.length )];
}

function getDomainName(url) {
  var elem = document.createElement("A");
  elem.href = url;
  if (elem.hostname == "feedproxy.google.com") {
    var mm = url.match(/\/\~r\/([^\/]+)/);
    if (mm.length == 2) {
      return mm[1];
    }
  }
  var parts = elem.hostname.replace(/^www\./i, '').split('.');
  var plen = parts.length;
  if( ["co", "com", "org", "net", "biz"].indexOf(parts[plen - 2]) != -1 ) {
    return parts[plen - 3];
  }
  else {
    return parts[plen - 2];
  }
}