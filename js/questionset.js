var H5P = H5P || {};

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
          '  <% if (introPage.title) { %>' +
          '    <div class="title"><span><%= introPage.title %></span></div>' +
          '  <% } %>' +
          '  <% if (introPage.introduction) { %>' +
          '    <div class="introduction"><%= introPage.introduction %></div>' +
          '  <% } %>' +
          '  <div class="buttons"><a class="qs-startbutton h5p-button"><%= introPage.startButtonText %></a></div>' +
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
          '    <a class="prev h5p-button" title="<%= texts.prevButton %>"></a>' +
          '    <a class="next h5p-button" title="<%= texts.nextButton %>"></a>' +
          '    <a class="finish h5p-button"><%= texts.finishButton %></a>' +
          '  </div>' +
          '</div>';

  var resulttemplate =
          '<div class="questionset-results">' +
          '  <div class="greeting"><%= message %></div>' +
          '  <div class="score <%= scoreclass %>">' +
          '     <div class="emoticon"></div>' +
          '     <div class="resulttext <%= scoreclass %>"><% if (comment) { %><h2><%= comment %></h2><% } %><%= score %><br><%= resulttext %></div>' +
          '  </div>' +
          '  <div class="buttons"><a class="h5p-button qs-finishbutton"><%= finishButtonText %></a><a class="h5p-button qs-solutionbutton"><%= solutionButtonText %></a><a class="h5p-button qs-retrybutton"></a></div>' +
          '</div>';

  var defaults = {
    randomOrder: false,
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
      retryButtonText: 'Retry',
      showAnimations: false
    },
    override: {
      overrideButtons: false,
      overrideShowSolutionButton: false,
      overrideRetry: false
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

  // Instantiate question instances
  for (var i = 0; i < params.questions.length; i++) {
    var question = params.questions[i];
    // TODO: Render on init, inject in template.

    // override content parameters.
    if (params.override.overrideButtons) {
      // Extend subcontent with the overrided settings.
      $.extend(question.params.behaviour, {
        enableRetry: params.override.overrideRetry,
        enableSolutionsButton: params.override.overrideShowSolutionButton
      });
    }

    $.extend(question.params, {
      postUserStatistics: false
    });
    questionInstances.push(H5P.newRunnable(question, contentId));
  }

  // Update button state.
  var _updateButtons = function () {
    var answered = true;
    for (var i = questionInstances.length - 1; i >= 0; i--) {
      answered = answered && (questionInstances[i]).getAnswerGiven();
    }

    if (currentQuestion === 0) {
      $('.prev.h5p-button', $myDom).hide();
    } else {
      $('.prev.h5p-button', $myDom).show();
    }
    if (currentQuestion === (params.questions.length - 1)) {
      $('.next.h5p-button', $myDom).hide();
      if (answered) {
        $('.finish.h5p-button', $myDom).show();
      }
    } else {
      $('.next.h5p-button', $myDom).show();
      $('.finish.h5p-button', $myDom).hide();
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
    var instance = questionInstances[questionNumber];
    if (instance.$ !== undefined) {
      instance.$.trigger('resize');
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

  /**
   * Show solutions for subcontent, and hide subcontent buttons.
   * Used for contracts with integrated content.
   * @public
   */
  var showSolutions = function () {
    for (var i = 0; i < questionInstances.length; i++) {
      try {
        questionInstances[i].showSolutions();
      }
      catch(error) {
        console.log(error);
        console.log("subcontent does not contain a valid showSolutions() function");
      }
    }
  };

  /**
   * Resets the task and every subcontent task.
   * Used for contracts with integrated content.
   * @public
   */
  var resetTask = function () {
    for (var i = 0; i < questionInstances.length; i++) {
      try {
        questionInstances[i].resetTask();
      }
      catch(error) {
        console.log(error);
        console.log("subcontent does not contain a valid resetTask() function");
      }
    }
    //Force the last page to be reRendered
    rendered = false;
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
    //Remove old score screen.
    $myDom.children().hide().filter('.questionset-results').remove();
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
      $('.qs-retrybutton', $myDom)
        .html(params.endGame.retryButtonText)
        .click(function () {
          resetTask();
          $myDom.children().hide().filter('.questionset').show();
          _showQuestion(params.initialQuestion);});
      addChart();
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
          $('<a class="h5p-button skip">' + params.endGame.skipButtonText + '</a>').click(function () {
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
        background: '#fff url("' + H5P.getPath(params.backgroundImage.path, contentId) + '") no-repeat 50% 50%',
        backgroundSize: '100% auto'
      });
    }

    if (params.introPage.backgroundImage !== undefined) {
      var $intro = $myDom.find('.intro-page');
      if ($intro.length) {
        $intro.css({
          background: '#fff url("' + H5P.getPath(params.introPage.backgroundImage.path, contentId) + '") no-repeat 50% 50%',
          backgroundSize: '100% auto'
        });
      }
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
    $('.next.h5p-button', $myDom).click(function () {
      _showQuestion(currentQuestion + 1);
    });
    $('.prev.h5p-button', $myDom).click(function () {
      _showQuestion(currentQuestion - 1);
    });
    $('.finish.h5p-button', $myDom).click(function () {
      _displayEndGame();
    });

    // Hide all but initial Question.
    _showQuestion(params.initialQuestion);
    _updateButtons();

    if (renderSolutions) {
      showSolutions();
    }

    this.$.trigger('resize');
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
  };

  var addChart = function () {
    var constructedTree = [
      {
        "name": "Top level",
        "parent": "null",
        "children" : [

        ]
      }
    ];

    var newArray = [];

    options.questions.forEach(function (qs) {
      var found = false;
      newArray.forEach(function (entry){
        if (entry.text === qs.library) {
          found = true;
          constructedTree[0].children[newArray.indexOf(entry)].children.push(
            {
              "name": qs.params.taskDescription !== undefined ? qs.params.taskDescription : (typeof qs.params.question === 'string' ? qs.params.question : qs.library),
              "parent": qs.library,
              "index": options.questions.indexOf(qs)
            }
          );
          entry.value += 1;
          entry.parameters.push(qs.params);
          return;
        }
      });
      if (!found) {
        newArray.push({value: 1, text: qs.library, parameters: [qs.params]});
        constructedTree[0].children.push(
          {
            "name": qs.library,
            "parent": constructedTree[0].name,
            "children": [
              {
                "name": qs.params.taskDescription !== undefined ? qs.params.taskDescription : (typeof qs.params.question === 'string' ? qs.params.question : qs.library),
                "parent": qs.library,
                "index": options.questions.indexOf(qs)
              }
            ]
          }
        );
      }
    });
    var data = [4, 8, 15, 16, 23, 42];
    var $chart = $('<div/>', {'class': 'chart'})
      .appendTo($('.questionset-results'));
    var w = 600;
    var h = 250;

    var dataset = newArray;

    var treeData = [
      {
        "name": "Top Level",
        "parent": "null",
        "children": [
          {
            "name": "Level 2: A",
            "parent": "Top Level",
            "children": [
              {
                "name": "Son of A",
                "parent": "Level 2: A"
              },
              {
                "name": "Daughter of A",
                "parent": "Level 2: A"
              }
            ]
          },
          {
            "name": "Level 2: B",
            "parent": "Top Level"
          }
        ]
      }
    ];

    // ************** Generate the tree diagram	 *****************
    var margin = {top: 20, right: 120, bottom: 20, left: 120},
      width = 960 - margin.right - margin.left,
      height = 500 - margin.top - margin.bottom;

    var i = 0,
      duration = 750;

    var tree = d3.layout.tree()
      .size([height, width]);

    var diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.y, d.x]; });

    var svg = d3.select(".chart").append("svg")
      .attr("width", width + margin.right + margin.left)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    root = treeData[0];
    root2 = constructedTree[0];

    root2.x0 = height / 2;
    root2.y0 = 0;

    function collapse(d) {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    }

    root2.children.forEach(collapse);
    update(root2);


    //update(root2);

    //update(root);

    d3.select('.chart').style("height", "800px");

    function update(source) {

      // Compute the new tree layout.
      var nodes = tree.nodes(root2).reverse(),
        links = tree.links(nodes);

      // Normalize for fixed-depth.
      nodes.forEach(function(d) { d.y = d.depth * 180; });

      // Update the nodes…
      var node = svg.selectAll("g.node")
        .data(nodes, function(d) { return d.id || (d.id = ++i); });

      // Enter any new nodes at the parent's previous position.
      var nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
        .on("click", function (d) {
          if (d.index !== undefined){
            resetTask();
            $myDom.children().hide().filter('.questionset').show();
            _showQuestion(d.index);
            return false;
          }
          click(d);
        });

      nodeEnter.append("circle")
        .attr("r", 1e-6)
        .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

      nodeEnter.append("text")
        .attr("x", function(d) { return d.children || d._children ? -10 : 10; })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
        .text(function(d) { return d.name; })
        .style("fill-opacity", 1e-6);

      // Transition nodes to their new position.
      var nodeUpdate = node.transition()
        .duration(duration)
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

      nodeUpdate.select("circle")
        .attr("r", 4.5)
        .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

      nodeUpdate.select("text")
        .style("fill-opacity", 1);

      // Transition exiting nodes to the parent's new position.
      var nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
        .remove();

      nodeExit.select("circle")
        .attr("r", 1e-6);

      nodeExit.select("text")
        .style("fill-opacity", 1e-6);

      // Update the links…
      var link = svg.selectAll("path.link")
        .data(links, function(d) { return d.target.id; });

      // Enter any new links at the parent's previous position.
      link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("d", function(d) {
          var o = {x: source.x0, y: source.y0};
          return diagonal({source: o, target: o});
        });

      // Transition links to their new position.
      link.transition()
        .duration(duration)
        .attr("d", diagonal);

      // Transition exiting nodes to the parent's new position.
      link.exit().transition()
        .duration(duration)
        .attr("d", function(d) {
          var o = {x: source.x, y: source.y};
          return diagonal({source: o, target: o});
        })
        .remove();

      // Stash the old positions for transition.
      nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    // Toggle children on click.
    function click(d) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      update(d);
    }
  };



  // Masquerade the main object to hide inner properties and functions.
  var returnObject = {
    $: $(this),
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