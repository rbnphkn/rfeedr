// main.js should be included before this
function SourceController($scope) {
  $scope.sources = _sources_;

  $scope.updateSources = function() {
    $scope.sources = _sources_;
  };

  $scope.addSource = function (){
    var newSource = { url: $scope.url, rscore: 1.0};
    _sources_.push(newSource);
    $scope.updateSources();
    _pipeline_.unshift({ url: newSource.url, nextFetch: (new Date).getTime() });
    $scope.url = "";
    $scope.rscore = 1.0;
    _db_.transaction( function(tx) {
      tx.executeSql('INSERT INTO sourceList (url, rscore) VALUES ("' + newSource.url + '", ' + newSource.rscore + ')');
    });
  };
}
