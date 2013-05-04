
buster.testCase("Automated Log Messages",

    {
        setUp: function () {
            this.timeout = 2000; // 1000ms ~ 1s

        },
        "getTopicRevisions" : {
            setUp: function () {
                this.url = 'http://skynet.usersys.redhat.com:8080/TopicIndex',
                this._id = 14577;

            },
            "should return the right number of total revisions" : function (done) {

                getTopicRevisions(this.url, this._id, function (result) {
                    var numRevisionsTotal = 10;
                    assert.equals(result.revisions.items.length, numRevisionsTotal);
                    done();
                });
            }
        },
        "getTopicRevisionsSince" : {
            setUp: function () {
                this.url = 'http://skynet.usersys.redhat.com:8080/TopicIndex',
                this._id = 14577,
                this._date = "20-04-2013",
                this.numRevisionsRange = 5;
            },
            "should return correct number of revisions in date range" : function (done) {
                getTopicRevisionsSince(this.url, this._id, this._date, function (result){
                    var numRevisionsRange = 5;
                    assert.equals(result.length, numRevisionsRange);
                    done();
                });
            }
        },
        "getLogMessage" : {
            setUp: function () {
                this.url = 'http://skynet.usersys.redhat.com:8080/TopicIndex',
                this._id = 14577,
                this.minor_rev = 446211,
                this.major_rev = 446656,
                this._date = "20-04-2013",
                this.numRevisionsRange = 5;
            },
            "should not return a minor log message" : function (done) {
                getLogMessage(this.url, this._id, this.minor_rev, function (result) {
                    assert.equals(result, null);
                    done();
                });
            },
            "should return a major log message" : function (done) {
                getLogMessage(this.url, this._id, this.major_rev, function (result) {
                    refute.equals(result, null);
                    done();
                });
            }
        },
        "getLogMessagesSince" : {
            setUp: function () {
                this.url = 'http://skynet.usersys.redhat.com:8080/TopicIndex',
                this._id = 14577,
                this.minor_rev = 446211,
                this.major_rev = 446656,
                this._date = "20-04-2013",
                this.numRevisionsRange = 5,
                this.test_2 = {
                    id: 14579,
                    date_in_range: "16-04-2013",
                    date_out_range: "20-04-2013"
                };
            },
            "should return a log message in range": function (done) {
                getLogMessagesSince(this.url, this._id, this._date, function (result) {
                    assert.equals(result.length, 1);
                    assert.equals(typeof result, "object")
                    done();
                });
            },
            "should return a message in range": function (done) {
                getLogMessagesSince(this.url, this.test_2.id, this.test_2.date_in_range, function (result) {
                    assert.equals(result.length, 1);
                    assert.equals(typeof result, "object");
                    done();
                });
            },
            "should not return a message out of range": function (done) {
                getLogMessagesSince(this.url, this.test_2.id, this.test_2.date_out_range, function(result){
                    assert.equals(result.length, 0);
                    assert.equals(typeof result, "object")
                    done();
                });
            }
        },
        "getLogMessagesForBookSince": {
            setUp: function () {
                this.url = 'http://skynet.usersys.redhat.com:8080/TopicIndex',
                this._id = 14577,
                this.specid = 14566,
                this.minor_rev = 446211,
                this.major_rev = 446656,
                this._date = "23-04-2013",
                this.numRevisionsRange = 5;
            },
            "should return log messages only in range": function (done) {
                getLogMessagesForBookSince(this._date, this.url, true, null, function (result){
                    done();
                });
            }
        }
    }
);

/*
describe('getTopicRevisions', function (done) {

    var url = 'http://skynet.usersys.redhat.com:8080/TopicIndex',
        _id = 14577,
        numRevisions = 9;

    it('should return the right number of total revisions', function () {
        getTopicRevisions(url, _id, function (result) {
            expect(result.revisions.items.length).toEqual(numRevisions);
            done();
        });
    });

   // it ('should return the correct number of revisions for a date range', function () {

   // });

});

    */