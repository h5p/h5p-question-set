// Will render a Question with multiple choices for answers.

// Options format:
// {
//   title: "Optional title for question box",
//   question: "Question text",
//   answers: [{text: "Answer text", correct: false}, ...],
//   singleAnswer: true, // or false, will change rendered output slightly.
// }
//
// Events provided:
// - h5pQuestionSetFinished: Triggered when a question is finished. (User presses Finish-button)
window.H5P = window.H5P || {};

H5P.QuestionSet = function (options, contentId) {
  if ( !(this instanceof H5P.QuestionSet) )
    return new H5P.QuestionSet(options, contentId);

  var $ = H5P.jQuery;
  var cp = H5P.getContentPath(contentId);

  var texttemplate = '' +
'<% if (introPage.showIntroPage) { %>' +
'<div class="intro-page">' +
'  <div class="title"><%= introPage.title %></div>' +
'  <div class="introduction"><%= introPage.introduction %></div>' +
'  <div class="buttons"><a id="qs-startbutton" class="button"><%= introPage.startButtonText %></a></div>' +
'</div>' +
'<%} %>' +
'<div class="questionset hidden">' +
'  <div class="title"><%= title %></div>' +
'  <% for (var i=0; i<questions.length; i++) { %>' +
'    <div class="question-container" id="q-<%= i %>">' +
'      <div><%= questions[i].machineName %></div>' +
'    </div>' +
'  <% } %>' +
'  <div class="qs-footer">' +
'    <div class="qs-progress">' +
'      <% if (progressType == "dots") { %>' +
'        <div class="dots-container">' +
'          <% for (var i=0; i<questions.length; i++) { %>' +
'          <span class="progress-dot unanswered" id="qdot-<%= i %>"></span>' +
'          <%} %>' +
'        </div>' +
'      <% } else if (progressType == "textual") { %>' +
'        <span class="progress-text"></span>' +
'      <% } %>' +
'    </div>' +
'    <a class="prev button"><%= texts.prevButton %></a>' +
'    <a class="next button"><%= texts.nextButton %></a>' +
'    <a class="finish button"><%= texts.finishButton %></a>' +
'  </div>' +
'</div>' +
  '';

  var resulttemplate = '' +
'<div class="questionset-results">' +
'  <div class="greeting"><%= greeting %></div>' +
'  <div class="score <%= scoreclass %>"><%= score %></div>' +
'  <div class="resulttext <%= scoreclass %>"><%= resulttext %></div>' +
'  <div class="buttons"><a class="button qs-finishbutton"><%= finishButtonText %></a></divbutton >' +
'</div>' +
'';

  var that = this;
  var defaults = {
    title: "",
    randomOrder: false,
    initialQuestion: 0,
    backgroundImage: "",
    progressType: 'dots',
    passPercentage: 50,
    questions: [],
    introPage: {
      showIntroPage: true,
      title: "Welcome",
      introduction: "Click start to start.",
      startButtonText: "Start"
    },
    texts: {
      prevButton: "Previous",
      nextButton: "Next",
      finishButton: "Finish",
      textualProgress: "Question: @current of @total questions"
    },
    endGame: {
      showResultPage: true,
      resultPage: {
        successGreeting: "Congratulations!",
        successComment: "You have enough correct answers to pass the test.",
        failGreeting: "Sorry!",
        failComment: "You don't have enough correct answers to pass this test.",
        scoreString: "@score/@total",
        finishButtonText: "Finish"
      },
      animations: {
        showAnimations: false,
        successVideo: undefined,
        failVideo: undefined
      }
    }
  };

  var template = new EJS({text: texttemplate});
  var endTemplate = new EJS({text: resulttemplate});
  var params = $.extend({}, defaults, options);

  var currentQuestion = 0;
  var questionInstances = new Array();
  var allQuestionsAnswered = false;
  var $myDom;

  if (params.randomOrder) {
    // TODO: Randomize order of questions
    console.log("TODO: Randomize order of questions");
  }

  // Instantiate question instances
  for (var i=0; i<params.questions.length; i++) {
    var quest = params.questions[i];
    // TODO: Render on init, inject in template.
    var tmp = new (H5P.classFromName(quest.machineName))(quest.options, contentId);
    questionInstances.push(tmp);
  }

  // Update button state.
  var _updateButtons = function () {
    var answered = true;
    for (var i = questionInstances.length - 1; i >= 0; i--) {
      answered = answered && (questionInstances[i]).getAnswerGiven();
    }

    if (currentQuestion === 0) {
      $('.prev.button', $myDom).hide();
    } else {
      $('.prev.button', $myDom).show();
    }
    if (currentQuestion == (params.questions.length - 1)) {
      $('.next.button', $myDom).hide();
      if (answered) {
        $('.finish.button', $myDom).show();
      }
    } else {
      $('.next.button', $myDom).show();
      $('.finish.button', $myDom).hide();
    }

 };

  var _showQuestion = function (questionNumber) {
    // Sanitize input.
    if (questionNumber < 0) { questionNumber = 0; }
    if (questionNumber >= params.questions.length) { questionNumber = params.questions.length - 1; }

     // Hide all questions
    $('.question-container', $myDom).hide();

    // Reshow the requested question
    $('#q-' + questionNumber, $myDom).show();

    // Update progress indicator
    // Test if current has been answered.
    if (params.progressType == 'textual') {
      $('.progress-text', $myDom).text(params.texts.textualProgress.replace("@current", questionNumber+1).replace("@total", params.questions.length));
    } else {
      // Set currentNess
      $('.progress-dot.current', $myDom).removeClass('current');
      $('#qdot-' + questionNumber, $myDom).addClass('current');
    }

    // Remember where we are
    currentQuestion = questionNumber;
    _updateButtons();
    return currentQuestion;
  };

  // Function for attaching the multichoice to a DOM element.
  var attach = function (target) {
    if (typeof(target) == "string") {
      target = $("#" + target);
    } else {
      target = $(target);
    }

    // Render own DOM into target.
    $myDom = target;
    $myDom.html(template.render(params)).css({
      backgroundImage: 'url(' + cp + params.backgroundImage.path + ')'
    });

    // Attach questions
    for (var i=0; i<questionInstances.length; i++) {
      var quest = questionInstances[i];
      // TODO: Render on init, inject in template.
      quest.attach('q-' + i);
      $(quest).on('h5pQuestionAnswered', function (ev) {
        $('#qdot-' + currentQuestion, $myDom).removeClass('unanswered').addClass('answered');
        _updateButtons();
      });
      if (quest.getAnswerGiven()) {
        $('#qdot-'+i, $myDom).removeClass('unanswered').addClass('answered');
      }
    }

    $('#qs-startbutton').click(function (ev) {
      $(this).parents('.intro-page').hide();
      $('.questionset', $myDom).removeClass('hidden');
    });

    // Set event listeners.
    $('.progress-dot', $myDom).click(function (ev) {
      var idx = parseInt($(this).attr('id').split('-')[1]);
      _showQuestion(idx);
    });
    $('.next.button', $myDom).click(function (ev) {
      _showQuestion(currentQuestion + 1);
    });
    $('.prev.button', $myDom).click(function (ev) {
      _showQuestion(currentQuestion - 1);
    });
    $('.finish.button', $myDom).click(function (ev) {
      // Get total score.
      var finals = getScore();
      var totals = totalScore();
      var scoreString = params.endGame.resultPage.scoreString.replace("@score", finals).replace("@total", totals);
      var success = ((100 * finals / totals) >= params.passPercentage);
      var eventData = {
        score: scoreString,
        passed: success
      };

      // Display result page.
      if (params.endGame.showResultPage) {
        // Render result page into.
        var eparams = {
          greeting: (success ? params.endGame.resultPage.succesGreeting : params.endGame.resultPage.failGreeting),
          score: scoreString,
          scoreclass: (success ? 'success' : 'fail'),
          resulttext: (success ? params.endGame.resultPage.successComment : params.endGame.resultPage.failComment),
          finishButtonText: params.endGame.resultPage.finishButtonText
        };
        endTemplate.update(target.attr('id'), eparams);

        var $video;
        if (params.endGame.animations.showAnimations) {
          var sources = "";
          var videoData = success ? params.endGame.animations.successVideo : params.endGame.animations.failVideo;

          if (videoData) {
            for (var key in videoData) {
              sources += '<source src="' + cp + videoData[key] + '" type="' + key + '">';
            }
            // TODO: Width/height from somewhere.
            $video = $('<video width="635" height="500">' + sources + 'Stop using IE you fool</video>');
            $video[0].autoplay = false;
            $video[0].load();
          }
        }

        $('.qs-finishbutton').click(function (ev) {
          // Display animation if present.
          if ($video) {
            // Start video.
            target.html($video);
            $video.on('play', function(ev) {
              console.log('Video started playing!!!');
            }).on('ended', function(ev) {
              console.log('Video is finished, quitting now!');
              // On animation finished:
              $(returnObject).trigger('h5pQuestionSetFinished', eventData);
            });
            // Press play on tape!
            $video[0].play();
          } else {
            // Trigger finished event.
            $(returnObject).trigger('h5pQuestionSetFinished', eventData);
          }
        });
      } else {
        $(returnObject).trigger('h5pQuestionSetFinished', eventData);
      }
    });

    // Hide all but initial Question.
    _showQuestion(params.initialQuestion);
    _updateButtons();
    return this;
  };

  // Get current score for questionset.
  var getScore = function () {
    var score = 0;
    for (var i = questionInstances.length - 1; i >= 0; i--) {
      score += questionInstances[i].getScore();
    }
    return score;
  };

  // Get total score possible for questionset.
  var totalScore = function () {
    var score = 0;
    for (var i = questionInstances.length - 1; i >= 0; i--) {
      score += questionInstances[i].totalScore();
    }
    return score;
  };

  // Masquerade the main object to hide inner properties and functions.
  var returnObject = {
    attach: attach, // Attach to DOM object
    getQuestions: function () {return questionInstances;},
    getScore: getScore,
    totalScore: totalScore,
    defaults: defaults // Provide defaults for inspection
  };
  return returnObject;
};
