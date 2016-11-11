var H5P = H5P || {};

/**
 * Will render a Question with multiple choices for answers.
 *
 * Events provided:
 * - h5pQuestionSetFinished: Triggered when a question is finished. (User presses Finish-button)
 *
 * @param {Array} options
 * @param {int} contentId
 * @param {Object} contentData
 * @returns {H5P.QuestionSet} Instance
 */
H5P.QuestionSet = (function($, EventDispatcher) {
  var QuestionSet = function (options, contentId, contentData) {
    var self = this;
    EventDispatcher.call(this);
    self.contentId = contentId;
    self.isEndgameRendered = false;

    // set default params
    var params = $.extend(true, {}, getDefaults(), options);

    // add the params to the this scope
    $.extend(true, this, params);

    contentData = contentData || {};

    // Bring question set up to date when resuming
    if (contentData.previousState) {
      if (contentData.previousState.progress) {
        currentQuestion = contentData.previousState.progress;
      }

      questionOrder = contentData.previousState.order;
    }

    this.instances = this.init(params, contentId, contentData);
  };

  QuestionSet.prototype = Object.create(EventDispatcher.prototype);
  QuestionSet.prototype.constructor = QuestionSet;

  var texttemplate =
    '<% if (introPage.showIntroPage) { %>' +
    '<div class="intro-page">' +
    '  <% if (introPage.title) { %>' +
    '    <div class="title"><span><%= introPage.title %></span></div>' +
    '  <% } %>' +
    '  <% if (introPage.introduction) { %>' +
    '    <div class="introduction"><%= introPage.introduction %></div>' +
    '  <% } %>' +
    '  <div class="buttons"><a class="qs-startbutton h5p-joubelui-button h5p-button"><%= introPage.startButtonText %></a></div>' +
    '</div>' +
    '<% } %>' +
    '<div tabindex="-1" class="qs-progress-announcer"></div>' +
    '<div class="questionset<% if (introPage.showIntroPage) { %> hidden<% } %>">' +
    '  <% for (var i=0; i<questions.length; i++) { %>' +
    '    <div class="question-container"></div>' +
    '  <% } %>' +
    '  <div class="qs-footer">' +
    '    <div class="qs-progress">' +
    '      <% if (progressType == "dots") { %>' +
    '        <ul class="dots-container" role="navigation">' +
    '          <% for (var i=0; i<questions.length; i++) { %>' +
    '           <li class="progress-item">' +
    '             <a href="#" ' +
    '               class="progress-dot unanswered<%' +
    '               if (disableBackwardsNavigation) { %> disabled <% } %>"' +
    '               aria-label="<%=' +
    '               texts.jumpToQuestion.replace("%d", i + 1).replace("%total", questions.length)' +
    '               + ", " + texts.unansweredText %>" tabindex="-1" ' +
    '               <% if (disableBackwardsNavigation) { %> aria-disabled="true" <% } %>' +
    '             ></a>' +
    '           </li>' +
    '          <% } %>' +
    '        </div>' +
    '      <% } else if (progressType == "textual") { %>' +
    '        <span class="progress-text"></span>' +
    '      <% } %>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var resulttemplate =
    '<div class="questionset-results">' +
    '  <div class="greeting"><%= message %></div>' +
    '  <div class="feedback-section">' +
    '    <div class="feedback-scorebar"></div>' +
    '    <div class="feedback-text"></div>' +
    '  </div>' +
    '  <% if (comment) { %>' +
    '  <div class="result-header"><%= comment %></div>' +
    '  <% } %>' +
    '  <% if (resulttext) { %>' +
    '  <div class="result-text"><%= resulttext %></div>' +
    '  <% } %>' +
    '  <div class="buttons">' +
    '    <button type="button" class="h5p-joubelui-button h5p-button qs-finishbutton"><%= finishButtonText %></button>' +
    '    <button type="button" class="h5p-joubelui-button h5p-button qs-solutionbutton"><%= solutionButtonText %></button>' +
    '    <button type="button" class="h5p-joubelui-button h5p-button qs-retrybutton"><%= retryButtonText %></button>' +
    '  </div>' +
    '</div>';

  var template = new EJS({text: texttemplate});
  var endTemplate = new EJS({text: resulttemplate});

  // TODO Move to QuestionSet
  var currentQuestion = 0;
  var questionInstances = [];
  var questionOrder; //Stores order of questions to allow resuming of question set
  var $myDom;
  var scoreBar;
  var up;
  var renderSolutions = false;
  var showingSolutions = false;
  var $template;


  var cloneQuestionAndIndex = function (question, index) {
    var result = H5P.cloneObject(question, true);
    result.initialIndex = index;
    return result;
  };

  var limitArrayToPoolSize = function (array, poolSize) {
    return array.slice(0, poolSize);
  };

  var initQuestions = function (questions, poolSize) {
    var result = questions.map(cloneQuestionAndIndex);
    result = H5P.shuffleArray(questions);
    result = limitArrayToPoolSize(result, poolSize);
    return result;
  };

  var useQuestionPool = function (questions, poolSize) {
    return poolSize && poolSize < questions.length || poolSize > 0;
  };

  var createQuestionContainerDom = function (params, questions) {
    var clonedParams = H5P.cloneObject(params, true);
    clonedParams.questions = questions;
    return $(template.render(clonedParams));
  };

  var overrideBehaviourAndSettings = function (question, override, $template, instance) {
    if (override.showSolutionButton) {
      question.params.behaviour.enableSolutionsButton = (override.showSolutionButton === 'on');
    }

    if (override.retryButton) {
      question.params.behaviour.enableRetry = (override.retryButton === 'on');
    }

    question.params.overrideSettings = question.params.overrideSettings || {};
    question.params.overrideSettings.$confirmationDialogParent = $template.last();
    question.params.overrideSettings.instance = instance;

    return question;
  };

  var getAnswersPreviousState = function (contentData, questionIndex) {
    if (contentData.previousState && contentData.previousState.answers) {
      return contentData.previousState.answers[questionIndex];
    }
  };

  var createQuestionInstance = function (questionSet, question, questionIndex, contentId, params, contentData) {
    var previousState = getAnswersPreviousState(contentData, questionIndex);
    var instance = H5P.newRunnable(question, contentId, undefined, undefined, {
      previousState: previousState,
      parent: questionSet
    });

    instance.on('resize', function () {
      up = true;
      questionSet.trigger('resize');
    });

    return instance;
  };

  QuestionSet.prototype.init = function (params, contentId, contentData) {
    var self = this;
    var questions = params.questions;

    if (contentData.previousState && contentData.previousState.questions) {
      questions = contentData.previousState.questions;
    }
    else if (useQuestionPool(questions, params.poolSize)) {
      questions = initQuestions(questions, params.poolSize);
    }
    else if (params.randomQuestions) {
      questions = H5P.shuffleArray(questions);
    }

    // Create the html template for the question container
    $template = createQuestionContainerDom(params, questions);

    questionInstances = questions.map(function (question, index) {
      question = overrideBehaviourAndSettings(question, params.override, $template, self);
      return createQuestionInstance(self, question, index, contentId, params, contentData);
    });

    // Resize all interactions on resize
    this.on('resize', onResize);

    return questionInstances;
  };

  var onResize = function () {
    if (up) {
      // Prevent resizing the question again.
      up = false;
    }
    else {
      questionInstances.forEach(function (instance) {
        instance.trigger('resize');
      });
    }
  };

  // Update button state.
  QuestionSet.prototype._updateButtons = function () {

    var self = this;

    // Verify that current question is answered when backward nav is disabled
    if (self.disableBackwardsNavigation) {
      if (questionInstances[currentQuestion].getAnswerGiven()
        && questionInstances.length - 1 !== currentQuestion) {
        questionInstances[currentQuestion].showButton('next');
      }
      else {
        questionInstances[currentQuestion].hideButton('next');
      }
    }

    var answered = true;
    for (var i = questionInstances.length - 1; i >= 0; i--) {
      answered = answered && (questionInstances[i]).getAnswerGiven();
    }

    if (currentQuestion === (self.questions.length - 1) &&
      questionInstances[currentQuestion]) {
      if (answered) {
        questionInstances[currentQuestion].showButton('finish');
      }
      else {
        questionInstances[currentQuestion].hideButton('finish');
      }
    }
  };

  var _stopQuestion = function (questionNumber) {
    if (questionInstances[questionNumber]) {
      pauseMedia(questionInstances[questionNumber]);
    }
  };

  QuestionSet.prototype._showQuestion = function (questionNumber, preventAnnouncement) {
    var self = this;

    // Sanitize input.
    if (questionNumber < 0) {
      questionNumber = 0;
    }
    if (questionNumber >= self.questions.length) {
      questionNumber = self.questions.length - 1;
    }

    currentQuestion = questionNumber;

    // Hide all questions
    $('.question-container', $myDom).hide().eq(questionNumber).show();

    if (questionInstances[questionNumber]) {
      // Trigger resize on question in case the size of the QS has changed.
      var instance = questionInstances[questionNumber];
      instance.setActivityStarted();
      if (instance.$ !== undefined) {
        instance.trigger('resize');
      }
    }

    // Update progress indicator
    // Test if current has been answered.
    if (self.progressType === 'textual') {
      $('.progress-text', $myDom).text(self.texts.textualProgress.replace("@current", questionNumber + 1).replace("@total", self.questions.length));
    }
    else {
      // Set currentNess
      var previousQuestion = $('.progress-dot.current', $myDom).parent().index();
      if (previousQuestion >= 0) {
        self.toggleCurrentDot(previousQuestion, false);
        self.toggleAnsweredDot(previousQuestion, questionInstances[previousQuestion].getAnswerGiven());
      }
      self.toggleCurrentDot(questionNumber, true);
    }

    if (!preventAnnouncement) {
      // Announce question number of total, must use timeout because of buttons logic
      setTimeout(function () {
        var humanizedProgress = self.texts.readSpeakerProgress
          .replace('@current', (currentQuestion + 1).toString())
          .replace('@total', questionInstances.length.toString());

        $('.qs-progress-announcer', $myDom)
          .html(humanizedProgress)
          .show().focus();

        if (instance && instance.readFeedback) {
          instance.readFeedback();
        }
      }, 0);
    }

    // Remember where we are
    self._updateButtons();
    self.trigger('resize');
    return currentQuestion;
  };

  /**
   * Show solutions for subcontent, and hide subcontent buttons.
   * Used for contracts with integrated content.
   * @public
   */
  var showSolutions = function () {
    showingSolutions = true;
    for (var i = 0; i < questionInstances.length; i++) {

      // Enable back and forth navigation in solution mode
      toggleDotsNavigation(true);
      if (i < questionInstances.length - 1) {
        questionInstances[i].showButton('next');
      }
      if (i > 0) {
        questionInstances[i].showButton('prev');
      }

      try {
        // Do not read answers
        questionInstances[i].toggleReadSpeaker(true);
        questionInstances[i].showSolutions();
        questionInstances[i].toggleReadSpeaker(false);
      }
      catch (error) {
        H5P.error("subcontent does not contain a valid showSolutions function");
        H5P.error(error);
      }
    }
  };

  /**
   * Toggles whether dots are enabled for navigation
   */
  var toggleDotsNavigation = function (enable) {
    $('.progress-dot', $myDom).each(function () {
      $(this).toggleClass('disabled', !enable);
      $(this).attr('aria-disabled', enable ? 'false' : 'true');
      // Remove tabindex
      if (!enable) {
        $(this).attr('tabindex', '-1');
      }
    });
  };

  /**
   * Resets the task and every subcontent task.
   * Used for contracts with integrated content.
   * @public
   */
  QuestionSet.prototype.resetTask = function () {
    var self = this;

    showingSolutions = false;

    questionInstances.forEach(function(instance, index){
      if(typeof instance.resetTask === 'function'){
        instance.resetTask();
      } else {
        H5P.error("subcontent does not contain a valid resetTask function");
      }

      // Hide back and forth navigation in normal mode
      if (self.disableBackwardsNavigation) {
        toggleDotsNavigation(false);

        var isAnsweredFirstQuestion = (index === 0 && instance.getAnswerGiven());
        instance[isAnsweredFirstQuestion ? 'showButton': 'hideButton']('next');
        instance.hideButton('prev');
      }
    });

    // Hide finish button
    var lastQuestionInstance = questionInstances[questionInstances.length - 1];
    lastQuestionInstance.hideButton('finish');

    // Mark all tasks as unanswered:
    $('.progress-dot').each(function (idx) {
      self.toggleAnsweredDot(idx, false);
    });

    //Force the last page to be reRendered
    self.rendered = false;

    if (self.randomQuestions) {
      self.renderRandomizedQuestions();
    }
  };

  /**
   * Randomizes question instances
   */
  QuestionSet.prototype.renderRandomizedQuestions = function () {
    var self = this;

    self.removeQuestionsFromDom();

    questionInstances = H5P.shuffleArray(questionInstances);

    questionInstances.forEach(function(question, i){
      var $questionContainer = $('.question-container:eq(' + i + ')', $myDom);
      // Make sure styles are not being added twice
      $questionContainer.attr('class', 'question-container');
      question.attach($questionContainer, $myDom);

      // toggle buttons
      var isFirst = (i === 0);
      var isLast = (i === questionInstances.length - 1);
      self.toggleButtonsForQuestion(question, isFirst, isLast);
    });
  };

  QuestionSet.prototype.removeQuestionsFromDom = function () {
    $('.question-container', $myDom).each(function () {
      $(this).children().detach();
    });
  };


  QuestionSet.prototype.toggleButtonsForQuestion = function (question, isFirst, isLast) {
    var self = this;
    //Show buttons if necessary
    question[isLast ? 'showButton' : 'hideButton']('finish');
    question[!isLast ? 'showButton' : 'hideButton']('next');

    if (isFirst || self.disableBackwardsNavigation) {
      question.hideButton('prev');
    }
    else {
      question.showButton('prev');
    }
  };

  QuestionSet.prototype.moveQuestion = function (direction) {
    var self = this;
    if (self.disableBackwardsNavigation && !questionInstances[currentQuestion].getAnswerGiven()) {
      questionInstances[currentQuestion].hideButton('next');
      questionInstances[currentQuestion].hideButton('finish');
      return;
    }

    _stopQuestion(currentQuestion);
    if (currentQuestion + direction >= questionInstances.length) {
      self._displayEndGame();
    }
    else {
      // Allow movement if backward navigation enabled or answer given
      self._showQuestion(currentQuestion + direction);
    }
  };

  /**
   * Toggle answered state of dot at given index
   * @param {number} dotIndex Index of dot
   * @param {boolean} isAnswered True if is answered, False if not answered
   */
  QuestionSet.prototype.toggleAnsweredDot = function (dotIndex, isAnswered) {
    var $el = $('.progress-dot:eq(' + dotIndex + ')', $myDom);

    // Skip current button
    if ($el.hasClass('current')) {
      return;
    }

    // Ensure boolean
    isAnswered = !!isAnswered;

    var label = this.texts.jumpToQuestion
        .replace('%d', (dotIndex + 1).toString())
        .replace('%total', $('.progress-dot', $myDom).length) +
      ', ' +
      (isAnswered ? this.texts.answeredText : this.texts.unansweredText);

    $el.toggleClass('unanswered', !isAnswered)
      .toggleClass('answered', isAnswered)
      .attr('aria-label', label);
  };

  /**
   * Toggle current state of dot at given index
   * @param dotIndex
   * @param isCurrent
   */
  QuestionSet.prototype.toggleCurrentDot = function (dotIndex, isCurrent) {
    var self = this;
    var $el = $('.progress-dot:eq(' + dotIndex + ')', $myDom);
    var texts = self.texts;
    var label = texts.jumpToQuestion
      .replace('%d', (dotIndex + 1).toString())
      .replace('%total', $('.progress-dot', $myDom).length);

    if (!isCurrent) {
      var isAnswered = $el.hasClass('answered');
      label += ', ' + (isAnswered ? texts.answeredText : texts.unansweredText);
    }
    else {
      label += ', ' + texts.currentQuestionText;
    }

    var disabledTabindex = self.disableBackwardsNavigation && !showingSolutions;
    $el.toggleClass('current', isCurrent)
      .attr('aria-label', label)
      .attr('tabindex', isCurrent && !disabledTabindex ? 0 : -1);
  };

  QuestionSet.prototype._displayEndGame = function () {
    var self = this;
    $('.progress-dot.current', $myDom).removeClass('current');
    if (self.isEndgameRendered) {
      $myDom.children().hide().filter('.questionset-results').show();
      self.trigger('resize');
      return;
    }

    //Remove old score screen.
    $myDom.children().hide().filter('.questionset-results').remove();
    self.isEndgameRendered = true;

    // Get total score.
    var finals = self.getScore();
    var totals = self.getMaxScore();
    var scoreString = self.endGame.scoreString.replace("@score", finals).replace("@total", totals);
    var success = ((100 * finals / totals) >= self.passPercentage);
    var eventData = {
      score: scoreString,
      passed: success
    };

    if (self.endGame.showAnimations) {
      var videoData = success ? self.endGame.successVideo : self.endGame.failVideo;
      if (videoData) {
        $myDom.children().hide();
        var $videoContainer = $('<div class="video-container"></div>').appendTo($myDom);

        var video = new H5P.Video({
          sources: videoData,
          fitToWrapper: true,
          controls: false,
          autoplay: false
        }, contentId);
        video.on('stateChange', function (event) {
          if (event.data === H5P.Video.ENDED) {
            displayResults(success, totals, eventData, scoreString, finals);
            $videoContainer.hide();
          }
        });
        video.attach($videoContainer);
        // Resize on video loaded
        video.on('loaded', function () {
          self.trigger('resize');
        });
        video.play();

        if (self.endGame.skippable) {
          $('<a class="h5p-joubelui-button h5p-button skip">' + self.endGame.skipButtonText + '</a>').click(function () {
            video.pause();
            $videoContainer.hide();
            displayResults(success, totals, eventData, scoreString, finals);
          }).appendTo($videoContainer);
        }

        return;
      }
    }
    // Trigger finished event.
    self.displayResults(success, totals, eventData, scoreString, finals);
    self.trigger('resize');
  };

  /**
   * Makes our buttons behave like other buttons.
   *
   * @private
   * @param {string} classSelector
   * @param {function} handler
   */
  var hookUpButton = function (classSelector, handler) {
    $(classSelector, $myDom).click(handler).keypress(function (e) {
      if (e.which === 32) {
        handler();
        e.preventDefault();
      }
    });
  };

  QuestionSet.prototype.displayResults = function (success, totals, eventData, scoreString, finals) {
    var self = this;
    self.triggerXAPICompleted(self.getScore(), self.getMaxScore(), success);

    var eparams = {
      message: self.endGame.showResultPage ? self.endGame.message : self.endGame.noResultMessage,
      comment: self.endGame.showResultPage ? (success ? self.endGame.successGreeting : self.endGame.failGreeting) : undefined,
      resulttext: self.endGame.showResultPage ? (success ? self.endGame.successComment : self.endGame.failComment) : undefined,
      finishButtonText: self.endGame.finishButtonText,
      solutionButtonText: self.endGame.solutionButtonText,
      retryButtonText: self.endGame.retryButtonText
    };

    // Show result page.
    $myDom.children().hide();
    $myDom.append(endTemplate.render(eparams));

    if (self.endGame.showResultPage) {
      // Add event handlers to summary buttons
      hookUpButton('.qs-finishbutton', function () {
        self.trigger('h5pQuestionSetFinished', eventData);
      });
      hookUpButton('.qs-solutionbutton', function () {
        showSolutions();
        $myDom.children().hide().filter('.questionset').show();
        self._showQuestion(self.initialQuestion);
      });
      hookUpButton('.qs-retrybutton', function () {
        self.resetTask();
        $myDom.children().hide();

        var $intro = $('.intro-page', $myDom);
        if ($intro.length) {
          // Show intro
          $('.intro-page', $myDom).show();
        }
        else {
          // Show first question
          $('.questionset', $myDom).show();
          self._showQuestion(self.initialQuestion);
        }
      });

      if (scoreBar === undefined) {
        scoreBar = H5P.JoubelUI.createScoreBar(totals);
      }
      scoreBar.appendTo($('.feedback-scorebar', $myDom));
      scoreBar.setScore(finals);
      $('.feedback-text', $myDom).html(scoreString);

      // Announce that the question set is complete
      setTimeout(function () {
        $('.qs-progress-announcer', $myDom)
          .html(eparams.message + '.' +
            scoreString + '.' +
            eparams.comment + '.' +
            eparams.resulttext)
          .show().focus();
      }, 0);
    }
    else {
      // Remove buttons and feedback section
      $('.qs-finishbutton, .qs-solutionbutton, .qs-retrybutton, .feedback-section', $myDom).remove();
    }

    self.trigger('resize');
  };

  // Function for attaching the multichoice to a DOM element.
  QuestionSet.prototype.attach = function (target) {
    var self = this;
    if (this.isRoot()) {
      this.setActivityStarted();
    }
    if (typeof(target) === "string") {
      $myDom = $('#' + target);
    }
    else {
      $myDom = $(target);
    }

    // Render own DOM into target.
    $myDom.children().remove();
    $myDom.append($template);
    if (this.backgroundImage !== undefined) {
      $myDom.css({
        overflow: 'hidden',
        background: '#fff url("' + H5P.getPath(this.backgroundImage.path, contentId) + '") no-repeat 50% 50%',
        backgroundSize: '100% auto'
      });
    }

    if (this.introPage.backgroundImage !== undefined) {
      var $intro = $myDom.find('.intro-page');
      if ($intro.length) {
        var bgImg = this.introPage.backgroundImage;
        var bgImgRatio = (bgImg.height / bgImg.width);
        $intro.css({
          background: '#fff url("' + H5P.getPath(bgImg.path, contentId) + '") no-repeat 50% 50%',
          backgroundSize: 'auto 100%',
          minHeight: bgImgRatio * +window.getComputedStyle($intro[0]).width.replace('px', '')
        });
      }
    }
    var registerImageLoadedListener = function (question) {
      H5P.on(question, 'imageLoaded', function () {
        self.trigger('resize');
      });
    };

    // Attach questions
    for (var i = 0; i < questionInstances.length; i++) {
      var question = questionInstances[i];

      question.attach($('.question-container:eq(' + i + ')', $myDom));

      // Listen for image resize
      registerImageLoadedListener(question);

      // Add finish button
      question.addButton('finish', this.texts.finishButton, self.moveQuestion.bind(self, 1), false);

      // Add next button
      question.addButton('next', '', self.moveQuestion.bind(this, 1),
        !this.disableBackwardsNavigation || !!question.getAnswerGiven(), {
          href: '#', // Use href since this is a navigation button
          'aria-label': this.texts.nextButton
        });

      // Add previous button
      question.addButton('prev', '', self.moveQuestion.bind(this, -1),
        !(questionInstances[0] === question || self.disableBackwardsNavigation), {
          href: '#', // Use href since this is a navigation button
          'aria-label': this.texts.prevButton
        });

      // Hide next button if it is the last question
      if (questionInstances[questionInstances.length - 1] === question) {
        question.hideButton('next');
      }

      question.on('xAPI', function (event) {
        var shortVerb = event.getVerb();
        if (shortVerb === 'interacted' ||
          shortVerb === 'answered' ||
          shortVerb === 'attempted') {
          self.toggleAnsweredDot(currentQuestion,
            questionInstances[currentQuestion].getAnswerGiven());
          self._updateButtons();
        }
        if (shortVerb === 'completed') {
          // An activity within this activity is not allowed to send completed events
          event.setVerb('answered');
        }
        if (event.data.statement.context.extensions === undefined) {
          event.data.statement.context.extensions = {};
        }
        event.data.statement.context.extensions['http://id.tincanapi.com/extension/ending-point'] = currentQuestion + 1;
      });

      // Mark question if answered
      self.toggleAnsweredDot(i, question.getAnswerGiven());
    }

    // Allow other libraries to add transitions after the questions have been inited
    $('.questionset', $myDom).addClass('started');

    $('.qs-startbutton', $myDom).click(function () {
      $(this).parents('.intro-page').hide();
      $('.questionset', $myDom).show();
      _showQuestion(self.initialQuestion);
    });

    /**
     * Triggers changing the current question.
     *
     * @private
     * @param {Object} [event]
     */
    var handleProgressDotClick = function (event) {
      // Disable dots when backward nav disabled
      event.preventDefault();
      if (self.disableBackwardsNavigation && !showingSolutions) {
        return;
      }
      _stopQuestion(currentQuestion);
      _showQuestion($(this).parent().index());
    };

    // Set event listeners.
    $('.progress-dot', $myDom).click(handleProgressDotClick).keydown(function (event) {
      var $this = $(this);
      switch (event.which) {
        case 13: // Enter
        case 32: // Space
          handleProgressDotClick.call(this, event);
          break;

        case 37: // Left Arrow
        case 38: // Up Arrow
          // Go to previous dot
          var $prev = $this.parent().prev();
          if ($prev.length) {
            $prev.children('a').attr('tabindex', '0').focus();
            $this.attr('tabindex', '-1');
          }
          break;

        case 39: // Right Arrow
        case 40: // Down Arrow
          // Go to next dot
          var $next = $this.parent().next();
          if ($next.length) {
            $next.children('a').attr('tabindex', '0').focus();
            $this.attr('tabindex', '-1');
          }
          break;
      }
    });


    // Hide all but current question
    self._showQuestion(currentQuestion, true);

    if (renderSolutions) {
      showSolutions();
    }
    // Update buttons in case they have changed (restored user state)
    self._updateButtons();

    self.trigger('resize');

    return this;
  };

  // Get current score for questionset.
  QuestionSet.prototype.getScore = function () {
    var score = 0;
    for (var i = questionInstances.length - 1; i >= 0; i--) {
      score += questionInstances[i].getScore();
    }
    return score;
  };

  // Get total score possible for questionset.
  QuestionSet.prototype.getMaxScore = function () {
    var score = 0;
    for (var i = questionInstances.length - 1; i >= 0; i--) {
      score += questionInstances[i].getMaxScore();
    }
    return score;
  };


  /**
   * @deprecated since version 1.9.2
   * @returns {number}
   */
  QuestionSet.prototype.totalScore = function () {
    return this.getMaxScore();
  };

  /**
   * Gather copyright information for the current content.
   *
   * @returns {H5P.ContentCopyrights}
   */
  QuestionSet.prototype.getCopyrights = function () {
    var self = this;
    var info = new H5P.ContentCopyrights();

    // Background
    if (self.backgroundImage !== undefined && self.backgroundImage.copyright !== undefined) {
      var background = new H5P.MediaCopyright(self.backgroundImage.copyright);
      background.setThumbnail(new H5P.Thumbnail(H5P.getPath(self.backgroundImage.path, contentId), self.backgroundImage.width, self.backgroundImage.height));
      info.addMedia(background);
    }

    // Questions
    var questionCopyrights;
    for (var i = 0; i < questionInstances.length; i++) {
      var instance = questionInstances[i];
      var qParams = self.questions[i].params;
      questionCopyrights = undefined;

      if (instance.getCopyrights !== undefined) {
        // Use the instance's own copyright generator
        questionCopyrights = instance.getCopyrights();
      }
      if (questionCopyrights === undefined) {
        // Create a generic flat copyright list
        questionCopyrights = new H5P.ContentCopyrights();
        H5P.findCopyrights(questionCopyrights, qParams, contentId);
      }

      // Determine label
      var label = (self.texts.questionLabel + ' ' + (i + 1));
      if (qParams.contentName !== undefined) {
        label += ': ' + qParams.contentName;
      }
      else if (instance.getTitle !== undefined) {
        label += ': ' + instance.getTitle();
      }
      questionCopyrights.setLabel(label);

      // Add info
      info.addContent(questionCopyrights);
    }

    // Success video
    var video;
    if (self.endGame.successVideo !== undefined && self.endGame.successVideo.length > 0) {
      video = self.endGame.successVideo[0];
      if (video.copyright !== undefined) {
        info.addMedia(new H5P.MediaCopyright(video.copyright));
      }
    }

    // Fail video
    if (self.endGame.failVideo !== undefined && self.endGame.failVideo.length > 0) {
      video = self.endGame.failVideo[0];
      if (video.copyright !== undefined) {
        info.addMedia(new H5P.MediaCopyright(video.copyright));
      }
    }

    return info;
  };

  QuestionSet.prototype.getQuestions = function () {
    return questionInstances;
  };

  QuestionSet.prototype.showSolutions = function () {
    renderSolutions = true;
  };

  /**
   * Stop the given element's playback if any.
   *
   * @param {object} instance
   */
  var pauseMedia = function (instance) {
    try {
      if (instance.pause !== undefined &&
        (instance.pause instanceof Function ||
        typeof instance.pause === 'function')) {
        instance.pause();
      }
    }
    catch (err) {
      // Prevent crashing, log error.
      H5P.error(err);
    }
  };

  /**
   * Returns the complete state of question set and sub-content
   *
   * @returns {Object} current state
   */
  QuestionSet.prototype.getCurrentState = function () {
    return {
      progress: showingSolutions ? questionInstances.length - 1 : currentQuestion,
      answers: questionInstances.map(function (qi) {
        return qi.getCurrentState();
      }),
      order: questionOrder
      //poolOrder: poolOrder
    };
  };

  var getDefaults = function () {
    return {
      initialQuestion: 0,
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
        prevButton: 'Previous question',
        nextButton: 'Next question',
        finishButton: 'Finish',
        textualProgress: 'Question: @current of @total questions',
        jumpToQuestion: 'Question %d of %total',
        questionLabel: 'Question',
        readSpeakerProgress: 'Question @current of @total',
        unansweredText: 'Unanswered',
        answeredText: 'Answered',
        currentQuestionText: 'Current question'
      },
      endGame: {
        showResultPage: true,
        noResultMessage: 'Finished',
        message: 'Your result:',
        successGreeting: 'Congratulations!',
        successComment: 'You have enough correct answers to pass the test.',
        failGreeting: 'Sorry!',
        failComment: "You don't have enough correct answers to pass this test.",
        scoreString: 'You got @score of @total points',
        finishButtonText: 'Finish',
        solutionButtonText: 'Show solution',
        retryButtonText: 'Retry',
        showAnimations: false,
        skipButtonText: 'Skip video'
      },
      disableBackwardsNavigation: false
    }
  };

  return QuestionSet;
})(H5P.jQuery, H5P.EventDispatcher);
