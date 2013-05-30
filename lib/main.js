var async = require('async');
var _ = require('underscore');
var db = openDatabase("db_rfeedr", "1.0", "RFeedR Local DB", 2 * 1024 * 1024);
var flipB;
var lastDraw = 0;
var pipeline = [];
var WAIT_BETWEEN_FETCH = 60000;

var divConfigs =  [
                    ["*box w-25 h-70", "*box w-50 h-70 box-b-l box-b-r", "*box w-25 h-70", "box w-50 h-30 box-b-r title-top", "box w-50 h-30 title-top"],
                    ["*box w-70 h-50 box-b-r title-top box-img-left", "*box w-30 h-50", "box w-30 h-50 box-b-r title-top", "*box w-70 h-50 title-top box-img-left"],
                    ["box w-30 h-60 box-b-r title-top", "*box w-70 h-60 box-img-left title-top", "*box w-40 h-40 box-img-left box-b-r title-top", "box w-30 h-40 box-b-r title-top", "box w-30 h-40 title-top"],
                    ["*box w-100 h-100 title-top box-img-left"]
                  ];

$(document).ready(function (){
  __main();
});

function __main() {
  flipB = $("#flip");
  flipB.turn({gradients: true, acceleration: true, width: $(window).width(), height: $(window).height() - 20, display: "single"});
  _loadFixtureData(function (){
    _fetchArticles();
  });
  _eventsBindings();
}

function _eventsBindings() {
  flipB.on("click", ".f-post.exp", _showPage);
  flipB.on("click", ".f-post.singp", _showOriginal);
  flipB.on("click", ".closePage", function() { _closePage(flipB.turn('page'), true); });
  flipB.on("forceClosePage", function() { _closePage(sessionStorage.singlePage, false); });
  flipB.on("turn", _turnEvent);
  flipB.on("turned", _turnedEvent);
  $(window).on("resize", function() {
    flipB.turn('size', $(window).width(), $(window).height() - 20);
    flipB.turn('resize');
  });
}

function _showPage(event) {
  var elem = $(event.target).closest(".f-post");
  var url = $(elem).attr('data-url');
  sessionStorage.returnToPage = flipB.turn('page');
  db.transaction(function (tx) {
    tx.executeSql('SELECT * FROM posts WHERE url="' + url + '"', [], function (tx, results) {
      if (results.rows.length) {
        writePage([results.rows.item(0)], 1, true);
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

function _closePage(currentPage, isReturnTo) {
  var returnToPage = sessionStorage.returnToPage ? sessionStorage.returnToPage : 2;
  sessionStorage.removeItem('returnToPage');
  sessionStorage.removeItem('singlePage');
  if (isReturnTo) { flipB.turn('page', returnToPage); }
  flipB.turn('removePage', currentPage);
}

function _turnEvent(event, page) {
  if(sessionStorage.singlePage) { sessionStorage.forClose = true; }
}

function _turnedEvent() {
  if(sessionStorage.forClose) { sessionStorage.removeItem('forClose'); flipB.trigger("forceClosePage"); }
}


function _fetchArticles() {
  var curTime = (new Date()).getTime();
  if (pipeline[0].nextFetch <= curTime) {
    var url = pipeline.shift().url;
    $(".spinner").show();
    console.log("Fetching articles at: " + new Date() + " from:" + url);

    pipeline.push({"url": url, nextFetch: curTime * 1000 * 60 * 15}); // Next fetch in 15 mins.
    _allFeeds([url], function (err){
      if (err) {
        console.error(err);
      }
      _drawPosts();
      $(".spinner").hide();
      $("#instr").show();
      _fetchArticles();
    });
  }
  else {
    setTimeout(function (){
      _fetchArticles();
    }, WAIT_BETWEEN_FETCH);  // Wait for 1 min and check
  }
}

function _drawPosts() {
  db.transaction(function (tx) {
    tx.executeSql('SELECT * FROM posts WHERE date > ' + lastDraw + ' ORDER BY date DESC LIMIT 30', [], function (tx, results) {
      var len = results.rows.length,
          i,
          pagePosts = [],
          idx= 0,
          alen = pickRandom([4,5]);
      for (i = 0; i < len; i++) {
        var post = results.rows.item(i);
        idx += 1;
//        page["urlSource"] = "RFeedR";
//        page["postTitle" + idx] = post.title;
//        page["postDate" + idx] = new Date(post.date);
//        page["postSummary" + idx] = post.summary;
//        page["imgSource" + idx] = post.image != "" ? post.image : null ;
        pagePosts.push(post);
        lastDraw = post.date > lastDraw ? post.date : lastDraw;
        if(idx == alen) {
          writePage(pagePosts, alen);
          pagePosts = [];
          idx=0;
          alen = pickRandom([4,5]);
        }
      }
      // Handle leftovers
      if( idx != 0 ) {
        writePage(pagePosts, alen);
      }
    });
  });
}

function _loadFixtureData(callback) {
  var defaultSourceList =  [
    { "url": "http://feeds.feedburner.com/TechCrunch/", "rscore": 3.0 },
    { "url": "http://feeds.mashable.com/Mashable", "rscore": 1.0 },
    { "url": "http://allthingsd.com/feed/", "rscore": 1.5 },
    { "url": "http://venturebeat.com/feed/", "rscore": 2.0 },
    { "url": "http://feeds2.feedburner.com/thenextweb", "rscore": 1.5 },
    { "url": "http://feeds.feedburner.com/ommalik", "rscore": 1.0 },
    { "url": "http://www.theverge.com/rss/index.xml", "rscore": 1.0 },
    { "url": "http://feeds.feedburner.com/nextbigwhat", "rscore": 1.0}
  ];

  db.transaction(function (tx) {
    tx.executeSql('CREATE TABLE IF NOT EXISTS sourceList (url text unique, rscore real)');
    tx.executeSql('CREATE TABLE IF NOT EXISTS posts (url text unique, title text, date real, summary text, image text)');

    tx.executeSql('SELECT * FROM sourceList ORDER BY rscore DESC', [], function (tx, results) {
      var len = results.rows.length, i;
      var nextFetch = (new Date()).getTime();
      if (len == 0) {
        for (i in defaultSourceList) {
          tx.executeSql('INSERT INTO sourceList (url, rscore) VALUES ("' + defaultSourceList[i].url + '", ' + defaultSourceList[i].rscore + ')');
          pipeline.push({"url": defaultSourceList[i].url, "nextFetch": nextFetch + i * WAIT_BETWEEN_FETCH});
         }
      }
      else {
        for (i=0; i<len; i++) {
          pipeline.push({"url": results.rows.item(i).url, "nextFetch": nextFetch + i * WAIT_BETWEEN_FETCH});
        }
      }
      callback();
    });
  });
}

function _allFeeds(sourceList, callback) {
  async.mapSeries(sourceList, _feedParser, function(err, posts) {
    for( var i in posts ) {
      for( var j in posts[i] ) {
        var post = posts[i][j],
            insertString = "('" + post.link + "', '" + post.title + "', " + (new Date(post.pubdate)).getTime() + ", '" + $(post.description).text().replace(/\'/g, '&quot;').replace(/\n|\r/g, '<br/>') + "', '" +
                (post.image && post.image.url ? post.image.url : "" ) + "')";
        (function(ins) {
          db.transaction(function (tx) {
            tx.executeSql("INSERT INTO posts (url, title, date, summary, image) VALUES " + ins);
          });
        })(insertString);
      }
    }
    callback(err);
  });
}

function pickRandom(items) {
  return items[Math.floor( Math.random()*items.length )];
}

function writePage(pagePosts, alen, flipEnd) {
  flipEnd = flipEnd || false;
  var eligConfs = _.filter(divConfigs, function (cfg) {return cfg.length == alen;});
  var dconf = pickRandom(eligConfs);
  var element = $(drawDiv(dconf, pagePosts, flipEnd));
  flipB.turn("addPage", element); // Add page at the beginning write after the cover page
  if (flipEnd || flipB.turn("page") == 1) {
    flipB.turn("page", flipEnd ? flipB.turn('pages') : 2);
  }
  if (flipEnd) { sessionStorage.singlePage = flipB.turn('page'); }
}

function _feedParser(source, callback) {
  var FeedParser = require('feedparser'),
      request = require('request');

  var posts = [];

  request(source)
      .pipe(new FeedParser())
      .on('error', function(error) {
        callback(error, posts);
      })
      .on('meta', function(meta) {
        // Do nothing for now
      })
      .on('article', function(post) {
        posts.push(post);
      })
      .on('end', function() {
        callback(null, posts);
      });
}

function drawDiv(conf, pagePosts, singlePost) {
  singlePost = singlePost || false;
  var elems = "<div class='f-page'>" +
              "<div class='f-title'>" +
              "<a href='#'>Home</a>" +
              "<h2>RFeedR<img class='spinner' src='./images/spinner-small.gif' style='display:none;'></h2>" +
              "<a href='#'>Settings</a>" +
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
      elems += "<h3>" + pagePosts[i].title + " <span>" + new Date(pagePosts[i].date) + "</span></h3>";
      elems += "<p>" + pagePosts[i].summary + "</p>";
    }
    elems += "</div>";
  }
  elems += "</div>";
  return elems;
}
