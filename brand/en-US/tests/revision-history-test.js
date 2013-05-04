var testable = require('scripts/publican-pressgang-utils');

var url = 'http://skynet.usersys.redhat.com:8080/TopicIndex',
    id = 14577,
    numRevisions = 9;

describe('getTopicRevisions', function () {
    it('should return the right number of total revisions', function (done) {
        testable.getTopicRevisions(url, id, function (result) {
            expect(result.revisions.items.length).toBe(numRevisions);
            done();
        });
    });

    it ('should return the correct number of revisions for a date range', function (done) {
        done();
    });

});