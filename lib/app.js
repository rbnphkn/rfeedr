function SourceController($scope) {
  $scope.sources = [];

  $scope.updateSources = function() {
    $scope.sources = [];
    _.each(_sources_, function(item) { $scope.sources.push(_clone_(item)) });
  };

  $scope.sourceChange = function(src) {
    var status = src.status == "YES" ? "NO" : "YES";
    _.find(_sources_, function(itr) { return itr.id == src.id }).status = status;
    if(status == "NO") {
      _pipeline_ = _.reject(_pipeline_, function(itr) { return itr.url = src.url; });
    }
    else if(status == "YES") {
      _pipeline_.unshift({url: src.url, sourceid: src.id, nextFetch: (new Date()).getTime() });
    }
    _updateTableWithId('sourceList', src.id, 'status', status);
  };

  $scope.addSource = function (){
    var newSource = { url: $scope.url, rscore: 1.0, status: "YES"};
    $scope.url = "";
    _db_.transaction( function(tx) {
      _sourceInsert(tx, newSource, (new Date).getTime(), "unshift");
      $scope.updateSources();
    });
  };

  $scope.toggleStatus = function () {
    console.log(this);
  }
}
