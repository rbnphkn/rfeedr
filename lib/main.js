var _async_ = require('async');
var _uuid_ = require('node-uuid');
var _clone_ = require('clone');
var _ = require('underscore');
var _db_ = openDatabase("db_rfeedr", "1.0", "RFeedR Local DB", 500 * 1024 * 1024); // 500 MB storage
var _flipB_;
var _lastDraw_ = (new Date()).getTime() + 6000000; // Just arbitrarily a future number
var _pipeline_ = [];
var _sources_ = [];
var WAIT_BETWEEN_FETCH = 60000;
var BATCHES = 10;

var _divConfigs_ =  [
                    ["*box w-25 h-70", "*box w-50 h-70 box-b-l box-b-r", "*box w-25 h-70", "box w-50 h-30 box-b-r title-top", "box w-50 h-30 title-top"],
                    ["*box w-70 h-50 box-b-r title-top box-img-left", "*box w-30 h-50", "box w-30 h-50 box-b-r title-top", "*box w-70 h-50 title-top box-img-left"],
                    ["box w-30 h-60 box-b-r title-top", "*box w-70 h-60 box-img-left title-top", "*box w-40 h-40 box-img-left box-b-r title-top", "box w-30 h-40 box-b-r title-top", "box w-30 h-40 title-top"],
                    ["box w-100 h-100 title-top"]
                  ];

$(document).ready(function (){
  __main();
});

function __main() {
  _flipB_ = $("#flip");
  _flipB_.turn({gradients: true, acceleration: true, width: $(window).width(), height: $(window).height() - 20, display: "single"});
  _loadFixtureData(function (){
    _fetchArticles();
  });
  _eventsBindings();
}

function _eventsBindings() {
  _flipB_.on("click", ".f-post.exp", _showPage);
  _flipB_.on("click", ".f-post.singp", _showOriginal);
  _flipB_.on("click", ".f-post.singp a", _stopPostClicks);
  _flipB_.on("click", ".closePage", function() { _closePage(_flipB_.turn('page'), true); });
  _flipB_.on("click", ".goHome", function() { location.reload(); })
  _flipB_.on("click", ".goSettings", function () { $( "#settings" ).modal(); });
  _flipB_.on("click", ".paginate", _paginate);
  _flipB_.on("forceClosePage", function() { _closePage(sessionStorage.singlePage, false); });
  _flipB_.on("turn", _turnEvent);
  _flipB_.on("turned", _turnedEvent);
  $(window).on("resize", function() {
    _flipB_.turn('size', $(window).width(), $(window).height() - 20);
    _flipB_.turn('resize');
  });
}

function _paginate(event) {
  var elem = $(event.target);
  _flipB_.turn($(elem).attr('flipB-paginate'));
}

function _showPage(event) {
  var elem = $(event.target).closest(".f-post");
  var url = $(elem).attr('data-url');
  sessionStorage.returnToPage = _flipB_.turn('page');
  _db_.transaction(function (tx) {
    tx.executeSql('SELECT * FROM posts WHERE url="' + url + '"', [], function (tx, results) {
      if (results.rows.length) {
        _writePage([results.rows.item(0)], 1, true);
      }
    });
  });
}

function _showOriginal(event) {
  var elem = $(event.target).closest(".f-post");
  var url = $(elem).attr('data-url');
  var html = "<iframe src='" + url + "' style='width: 100%; height: 90%; overflow:auto'/>";
  $(elem).removeClass('singp');
  $(elem).html(html);
}

function _stopPostClicks(event) {
  event.preventDefault();
}

function _closePage(currentPage, isReturnTo) {
  var returnToPage = sessionStorage.returnToPage ? sessionStorage.returnToPage : 2;
  sessionStorage.removeItem('returnToPage');
  sessionStorage.removeItem('singlePage');
  if (isReturnTo) { _flipB_.turn('page', returnToPage); }
  _flipB_.turn('removePage', currentPage);
}

function _turnEvent(event, page) {
  if(sessionStorage.singlePage) { sessionStorage.forClose = true; }
}

function _turnedEvent() {
  if(sessionStorage.forClose) { sessionStorage.removeItem('forClose'); _flipB_.trigger("forceClosePage"); }
  _checkAndDrawPages();
}


function _fetchArticles() {
  var curTime = (new Date()).getTime();
  if (_pipeline_[0].nextFetch <= curTime) {
    var pp = _pipeline_.shift();
    pp.nextFetch = curTime * 1000 * 60 * 15; // Next fetch in 15 mins.
    _pipeline_.push(pp);

    $(".spinner").show();
    console.log("Fetching articles at: " + new Date() + " from:" + pp.url);

    _allFeeds([_.omit(pp, 'nextFetch')], function (err){
      if (err) {
        console.error(err);
      }
      $(".spinner").hide();
      $("#instr").show();
      _fetchArticles();
      // Trigger draw page for the first time
      if (_flipB_.turn('pages') == 1) {
        _checkAndDrawPages();
      }
    });
  }
  else {
    setTimeout(function (){
      _fetchArticles();
    }, WAIT_BETWEEN_FETCH);  // Wait for 1 min and check
  }
}

function _checkAndDrawPages() {
  if( _flipB_.turn('page') + (BATCHES / 2) >= _flipB_.turn('pages') ) {
    _drawPosts();
  }
}

function _drawPosts() {
  _db_.transaction(function (tx) {
    var alen = [], totalItems = 0;
    for( var b = 0; b < BATCHES; b++ ) {
      var bb = pickRandom([4,5]);
      alen.push(bb);
      totalItems += bb;
    }
    tx.executeSql('SELECT * FROM posts WHERE date < ' + _lastDraw_ + ' ORDER BY date DESC LIMIT ' + totalItems, [], function (tx, results) {
      var len = results.rows.length,
          p = 0;
      for ( var i = 0; i < alen.length; i++) {
        var pagePosts = [];
        if (p + alen[i] <= len) {
          for (var j = 0; j < alen[i]; j++) {
            if (p < len) {
              var post = results.rows.item(p);
              p++;
              pagePosts.push(post);
              _lastDraw_ = post.date;
            }
          }
          _writePage(pagePosts, alen[i]);
        }
        else {
          break;
        }
      }
    });
  });
}

function _loadFixtureData(callback) {
  var defaultSourceList =  [
    { "url": "http://feeds.feedburner.com/TechCrunch/", "rscore": 3.0, "status": "YES" },
    { "url": "http://feeds.mashable.com/Mashable", "rscore": 1.0, "status": "YES"  },
    { "url": "http://allthingsd.com/feed/", "rscore": 1.5, "status": "YES"  },
    { "url": "http://venturebeat.com/feed/", "rscore": 2.0, "status": "YES"  },
    { "url": "http://feeds2.feedburner.com/thenextweb", "rscore": 1.5, "status": "YES"  },
    { "url": "http://feeds.feedburner.com/ommalik", "rscore": 1.0, "status": "YES"  },
    { "url": "http://www.theverge.com/rss/index.xml", "rscore": 1.0, "status": "YES"  },
    { "url": "http://feeds.feedburner.com/nextbigwhat", "rscore": 1.0, "status": "YES" }
  ];

  _db_.transaction(function (tx) {
    tx.executeSql('CREATE TABLE IF NOT EXISTS sourceList (id text primary key, url text unique, rscore real, status text)');
    tx.executeSql('CREATE TABLE IF NOT EXISTS posts (id text primary key, url text unique, title text, date real, summary text, image text, sourceid text, readStatus text)');
    tx.executeSql('SELECT * FROM sourceList ORDER BY rscore DESC', [], function (tx, results) {
      var len = results.rows.length, i;
      var nextFetch = (new Date()).getTime();
      if (len == 0) {
        for (i in defaultSourceList) {
          _sourceInsert(tx, defaultSourceList[i], nextFetch + i * WAIT_BETWEEN_FETCH);
         }
      }
      else {
        for (i=0; i<len; i++) {
          if( results.rows.item(i).status ) {
            _pipeline_.push({"url": results.rows.item(i).url, "nextFetch": nextFetch + i * WAIT_BETWEEN_FETCH, "sourceid": results.rows.item(i).id});
          }
          _sources_.push(results.rows.item(i));
        }
      }
      $("#settings .updateSources").click();
      callback();
    });
  });
}

function _sourceInsert(tx, sourceList, nextFetch, ppMethod) {
  var uuid = _uuid_.v1();
   ppMethod =  ppMethod || "push";
  tx.executeSql('INSERT INTO sourceList (id, url, rscore, status) VALUES ("' + uuid + '", "' + sourceList.url + '", ' + sourceList.rscore + ', "YES"' + ')');
  var pp = {"url": sourceList.url, "nextFetch": nextFetch, "sourceid": uuid};
  _pipeline_[ppMethod](pp);
  _sources_.push(sourceList);
}

function _updateTableWithId(table, id, attribute, value) {
  _db_.transaction(function(tx) {
     tx.executeSql("UPDATE " + table + " SET " + attribute + " = ? WHERE id='" + id + "'", [value]);
  });
}

function _allFeeds(sourceList, callback) {
  _async_.mapSeries(sourceList, _feedParser, function(err, posts) {
    for( var i in posts ) {
      for( var j in posts[i] ) {
        var post = posts[i][j],
            insertString = "('" + _uuid_.v1() + "', '" + post.link + "', '" + post.title + "', " + (new Date(post.pubdate)).getTime() + ", '" + post.description.replace(/\'/g, '&quot;').replace(/\n|\r/g, ' ') + "', '" +
                (post.image && post.image.url ? post.image.url : "" ) + "', '" + post.sourceid + "', 'NO')";
        (function(ins) {
          _db_.transaction(function (tx) {
            tx.executeSql("INSERT INTO posts (id, url, title, date, summary, image, sourceid, readStatus) VALUES " + ins);
          });
        })(insertString);
      }
    }
    callback(err);
  });
}

function _writePage(pagePosts, alen, flipEnd) {
  flipEnd = flipEnd || false;
  var eligConfs = _.filter(_divConfigs_, function (cfg) {return cfg.length == alen;});
  var dconf = pickRandom(eligConfs);
  var element = $(_drawDiv(dconf, pagePosts, flipEnd));
  _flipB_.turn("addPage", element); // Add page at the beginning write after the cover page
  if (flipEnd || _flipB_.turn("page") == 1) {
    _flipB_.turn("page", flipEnd ? _flipB_.turn('pages') : 2);
  }
  if (flipEnd) { sessionStorage.singlePage = _flipB_.turn('page'); }
}

function _feedParser(source, callback) {
  var FeedParser = require('feedparser'),
      request = require('request');

  var posts = [];

  request(source.url)
      .pipe(new FeedParser())
      .on('error', function(error) {
        callback(error, posts);
      })
      .on('meta', function(meta) {
        // Do nothing for now
      })
      .on('article', function(post) {
        post.sourceid = source.sourceid;
        posts.push(post);
      })
      .on('end', function() {
        callback(null, posts);
      });
}

function _drawDiv(conf, pagePosts, singlePost) {
  singlePost = singlePost || false;
  var elems = "<div class='f-page'>" +
              "<div class='f-title'>" +
              "<a href='#' flipB-paginate='previous' class='fl ml50 paginate'>&laquo; Previous Page</a>" +
              "<a href='#' class='fl goHome'>Refresh</a>" +
              "<a href='#' flipB-paginate='next' class='fr mr50 paginate'>Next Page &raquo;</a>" +
              "<a href='#' class='fr goSettings'>Settings</a>" +
      "<h2>RFeedR<img class='spinner' src='./images/spinner-small.gif' style='display:none;'></h2>" +
              "<div class='clr'></div>" +
              "</div>";
  if (singlePost) {
    elems += "<div class='closePage'>Close</div>";
  }
  for (var i=0; i < conf.length; i++) {
    var dc = conf[i];
    var hasImg = dc[0] == '*' ? (dc = dc.substr(1)) && true : false;
    dc = hasImg && pagePosts[i] && pagePosts[i].image == "" ? dc.replace("box-img-left", "") : dc;
    elems += "<div class='f-post " + ( singlePost ? "singp" : "exp") + " " + dc + "' data-url='" + (pagePosts[i] ? pagePosts[i].url : "") + "'>";
    if (pagePosts[i]) {
      if (hasImg && pagePosts[i].image != "") {
        elems += "<div class='img-cont'><img src='" + pagePosts[i].image + "'/></div>";
      }
      elems += "<h3>" + pagePosts[i].title + " <span>" + getDomainName( pagePosts[i].url ) + " • " + new Date(pagePosts[i].date) + "</span></h3>";
      elems += "<p>" + ( singlePost ? pagePosts[i].summary : stripHTML(pagePosts[i].summary) ) + "</p>";
    }
    elems += "</div>";
  }
  elems += "</div>";
  return elems;
}

