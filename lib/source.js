// main.js should be included before this
function SourceController($scope) {
  $scope.sources = _sources_;

  $scope.addSource = function (){
    var newSource = { url: $scope.url, rscore: $scope.rscore};
    $scope.sources.push(newSource);
    _pipeline_.push({ url: newSource.url, nextFetch: (new Date).getTime() });
    $scope.url = "";
    $scope.rscore = 1.0;
    _db_.transaction( function(tx) {
      tx.executeSql('INSERT INTO sourceList (url, rscore) VALUES ("' + newSource.url + '", ' + newSource.rscore + ')');
    });
  }
}
