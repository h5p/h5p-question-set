var H5P = H5P || {};

if (H5P.getPath === undefined) {
  /**
   * Find the path to the content files based on the id of the content
   *
   * Also identifies and returns absolute paths
   *
   * @param {String} path Absolute path to a file, or relative path to a file in the content folder
   * @param {Number} contentId Identifier of the content requesting the path
   * @returns {String} The path to use.
   */
  H5P.getPath = function (path, contentId) {
    if (path.substr(0, 7) === 'http://' || path.substr(0, 8) === 'https://') {
      return path;
    }

    return H5PIntegration.getContentPath(contentId) + path;
  };
}

/**
 * Will render a Question with multiple choices for answers.
 *
 * Events provided:
 * - h5pQuestionSetFinished: Triggered when a question is finished. (User presses Finish-button)
 *
 * @param {Array} options
 * @param {int} contentId
 * @returns {H5P.QuestionSet} Instance
 */
H5P.QuestionSet = function (options, contentId) {
  if (!(this instanceof H5P.QuestionSet)) {
    return new H5P.QuestionSet(options, contentId);
  }

  var $ = H5P.jQuery;

  var texttemplate =
          '<% if (introPage.showIntroPage) { %>' +
          '<div class="intro-page">' +
          '  <div class="title"><span><%= introPage.title %></span></div>' +
          '  <div class="introduction"><%= introPage.introduction %></div>' +
          '  <div class="buttons"><a class="qs-startbutton button"><%= introPage.startButtonText %></a></div>' +
          '</div>' +
          '<% } %>' +
          '<div class="questionset<% if (introPage.showIntroPage) { %> hidden<% } %>">' +
          '  <% for (var i=0; i<questions.length; i++) { %>' +
          '    <div class="question-container"></div>' +
          '  <% } %>' +
          '  <div class="qs-footer">' +
          '    <div class="qs-progress">' +
          '      <% if (progressType == "dots") { %>' +
          '        <div class="dots-container">' +
          '          <% for (var i=0; i<questions.length; i++) { %>' +
          '          <span class="progress-dot unanswered"></span>' +
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
          '</div>';

  var resulttemplate =
          '<div class="questionset-results">' +
          '  <div class="greeting"><%= message %></div>' +
          '  <div class="score <%= scoreclass %>">' +
          '     <div class="emoticon"></div>' +
          '     <div class="resulttext <%= scoreclass %>"><% if (comment) { %><h2><%= comment %></h2><% } %><%= score %><br><%= resulttext %></div>' +
          '  </div>' +
          '  <div class="buttons"><a class="button qs-finishbutton"><%= finishButtonText %></a><a class="button qs-solutionbutton"><%= solutionButtonText %></a></div>' +
          '</div>';

  var defaults = {
    randomOrder: false,
    initialQuestion: 0,
    backgroundImage: undefined,
    progressType: 'dots',
    passPercentage: 50,
    questions: [],
    introPage: {
      showIntroPage: false,
      title: '',
      introduction: '',
      startButtonText: 'Start'
    },
    texts: {
      prevButton: 'Previous',
      nextButton: 'Next',
      finishButton: 'Finish',
      textualProgress: 'Question: @current of @total questions'
    },
    endGame: {
      showResultPage: true,
      message: 'Your result:',
      successGreeting: 'Congratulations!',
      successComment: 'You have enough correct answers to pass the test.',
      failGreeting: 'Sorry!',
      failComment: "You don't have enough correct answers to pass this test.",
      scoreString: 'You got @score points of @total possible.',
      finishButtonText: 'Finish',
      solutionButtonText: 'Show solution',
      showAnimations: false,
      successVideo: undefined,
      failVideo: undefined
    },
    postUserStatistics: (H5P.postUserStatistics === true)
  };

  var template = new EJS({text: texttemplate});
  var endTemplate = new EJS({text: resulttemplate});
  var params = $.extend(true, {}, defaults, options);

  var currentQuestion = 0;
  var questionInstances = new Array();
  var $myDom;
  renderSolutions = false;

//  if (params.randomOrder) {
//    // TODO: Randomize order of questions
//  }

  // Instantiate question instances
  for (var i = 0; i < params.questions.length; i++) {
    var question = params.questions[i];
    // TODO: Render on init, inject in template.

    var libraryObject = H5P.libraryFromString(question.library);
    $.extend(question.params, {
      displaySolutionsButton: false,
      postUserStatistics: false
    });
    var tmp = new (H5P.classFromName(libraryObject.machineName))(question.params, contentId);
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
    if (currentQuestion === (params.questions.length - 1)) {
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
    if (questionNumber < 0) {
      questionNumber = 0;
    }
    if (questionNumber >= params.questions.length) {
      questionNumber = params.questions.length - 1;
    }

     // Hide all questions
    $('.question-container', $myDom).hide().eq(questionNumber).show();

    // Trigger resize on question in case the size of the QS has changed.
    if (questionInstances[questionNumber].resize !== undefined) {
      questionInstances[questionNumber].resize();
    }

    // Update progress indicator
    // Test if current has been answered.
    if (params.progressType === 'textual') {
      $('.progress-text', $myDom).text(params.texts.textualProgress.replace("@current", questionNumber+1).replace("@total", params.questions.length));
    }
    else {
      // Set currentNess
      $('.progress-dot.current', $myDom).removeClass('current');
      $('.progress-dot:eq(' + questionNumber +')', $myDom).addClass('current');
    }

    // Remember where we are
    currentQuestion = questionNumber;
    _updateButtons();
    return currentQuestion;
  };

  var showSolutions = function () {
    for (var i = 0; i < questionInstances.length; i++) {
      questionInstances[i].showSolutions();
    }
  };

  var rendered = false;

  var reRender = function () {
    rendered = false;
  };

  var _displayEndGame = function () {
    if (rendered) {
      $myDom.children().hide().filter('.questionset-results').show();
      return;
    }
    rendered = true;

    // Get total score.
    var finals = getScore();
    var totals = totalScore();
    var scoreString = params.endGame.scoreString.replace("@score", finals).replace("@total", totals);
    var success = ((100 * finals / totals) >= params.passPercentage);
    var eventData = {
      score: scoreString,
      passed: success
    };
    var displayResults = function () {
      if (params.postUserStatistics === true) {
        H5P.setFinished(contentId, getScore(), totalScore());
      }

      if (!params.endGame.showResultPage) {
        $(returnObject).trigger('h5pQuestionSetFinished', eventData);
        return;
      }

      var eparams = {
        message: params.endGame.message,
        comment: (success ? params.endGame.successGreeting : params.endGame.failGreeting),
        score: scoreString,
        scoreclass: (success ? 'success' : 'fail'),
        resulttext: (success ? params.endGame.successComment : params.endGame.failComment),
        finishButtonText: params.endGame.finishButtonText,
        solutionButtonText: params.endGame.solutionButtonText
      };

      // Show result page.
      $myDom.children().hide();
      $myDom.append(endTemplate.render(eparams));
      $('.qs-finishbutton').click(function () {
        $(returnObject).trigger('h5pQuestionSetFinished', eventData);
      });
      $('.qs-solutionbutton', $myDom).click(function () {
        showSolutions();
        $myDom.children().hide().filter('.questionset').show();
        _showQuestion(params.initialQuestion);
      });
    };

    if (params.endGame.showAnimations) {
      var videoData = success ? params.endGame.successVideo : params.endGame.failVideo;
      if (videoData) {
        $myDom.children().hide();
        var $videoContainer = $('<div class="video-container"></div>').appendTo($myDom);

        var video = new H5P.Video({
          files: videoData,
          fitToWrapper: true,
          controls: false,
          autoplay: false
        }, contentId);
        video.endedCallback = function () {
          displayResults();
          $videoContainer.hide();
        };
        video.attach($videoContainer);
        video.play();

        if (params.endGame.skipButtonText) {
          $('<a class="button skip">' + params.endGame.skipButtonText + '</a>').click(function () {
            video.stop();
            $videoContainer.hide();
            displayResults();
          }).appendTo($videoContainer);
        }

        return;
      }
    }
    // Trigger finished event.
    displayResults();
  };

  // Function for attaching the multichoice to a DOM element.
  var attach = function (target) {
    if (typeof(target) === "string") {
      $myDom = $('#' + target);
    }
    else {
      $myDom = $(target);
    }

    // Render own DOM into target.
    $myDom.html(template.render(params));
    if (params.backgroundImage !== undefined) {
      $myDom.css({
        overflow: 'hidden',
        background: '#000 url("' + H5P.getPath(params.backgroundImage.path, contentId) + '") no-repeat 50% 50%',
        backgroundSize: '100% auto'
      });
    }

    // Attach questions
    for (var i = 0; i < questionInstances.length; i++) {
      var question = questionInstances[i];

      question.attach($('.question-container:eq(' + i + ')', $myDom));
      $(question).on('h5pQuestionAnswered', function () {
        $('.progress-dot:eq(' + currentQuestion +')', $myDom).removeClass('unanswered').addClass('answered');
        _updateButtons();
      });
      if (question.getAnswerGiven()) {
        $('.progress-dot:eq(' + i +')'
        , $myDom).removeClass('unanswered').addClass('answered');
      }
    }

    // Allow other libraries to add transitions after the questions have been inited
    $('.questionset', $myDom).addClass('started');

    $('.qs-startbutton', $myDom).click(function () {
      $(this).parents('.intro-page').hide();
      $('.questionset', $myDom).removeClass('hidden');
      _showQuestion(currentQuestion);
    });

    // Set event listeners.
    $('.progress-dot', $myDom).click(function () {
      _showQuestion($(this).index());
    });
    $('.next.button', $myDom).click(function () {
      _showQuestion(currentQuestion + 1);
    });
    $('.prev.button', $myDom).click(function () {
      _showQuestion(currentQuestion - 1);
    });
    $('.finish.button', $myDom).click(function () {
      _displayEndGame();
    });

    // Hide all but initial Question.
    _showQuestion(params.initialQuestion);
    _updateButtons();

    if (renderSolutions) {
      showSolutions();
    }
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
      score += questionInstances[i].getMaxScore();
    }
    return score;
  };
  
  /**
   * Gather copyright information for the current content.
   *
   * @returns {H5P.ContentCopyrights}
   */
  var getCopyrights = function () {
    var info = new H5P.ContentCopyrights();
  
    // Background
    if (params.backgroundImage !== undefined && params.backgroundImage.copyright !== undefined) {
      var background = new H5P.MediaCopyright(params.backgroundImage.copyright);
      background.setThumbnail(new H5P.Thumbnail(H5P.getPath(params.backgroundImage.path, contentId), params.backgroundImage.width, params.backgroundImage.height));
      info.addMedia(background);
    }
    
    // Questions
    for (var i = 0; i < questionInstances.length; i++) {
      var questionInstance = questionInstances[i];
      if (questionInstance.getCopyrights !== undefined) {
        var rights = questionInstance.getCopyrights();
        if (rights !== undefined) {
          rights.setLabel('Question '+(i+1));
          info.addContent(rights);
        }
      }
    }
    
    // Success video
    if (params.endGame.successVideo !== undefined && params.endGame.successVideo.length > 0) {
      var video = params.endGame.successVideo[0];
      if (video.copyright !== undefined) {
        info.addMedia(new H5P.MediaCopyright(video.copyright));
      }
    }
    
    // Fail video
    if (params.endGame.failVideo !== undefined && params.endGame.failVideo.length > 0) {
      video = params.endGame.failVideo[0];
      if (video.copyright !== undefined) {
        info.addMedia(new H5P.MediaCopyright(video.copyright));
      }
    }
  
    return info;
  }

  // Masquerade the main object to hide inner properties and functions.
  var returnObject = {
    attach: attach, // Attach to DOM object
    getQuestions: function () {return questionInstances;},
    getScore: getScore,
    showSolutions: function () {
      renderSolutions = true;
    },
    totalScore: totalScore,
    reRender: reRender,
    defaults: defaults, // Provide defaults for inspection
    getCopyrights: getCopyrights
  };
  return returnObject;
};
