// Will render a Question with multiple choices for answers.

// Options format:
// {
//   title: "Optional title for question box",
//   question: "Question text",
//   answers: [{text: "Answer text", correct: false}, ...],
//   singleAnswer: true, // or false, will change rendered output slightly.
// }
window.H5P = window.H5P || {};

H5P.QuestionSet = function (options) {
  if ( !(this instanceof H5P.QuestionSet) )
    return new H5P.QuestionSet(options);

  var texttemplate = '' +
'<div class="questionset">' +
'  <div class="title"><%= title %></div>' +
'  <% for (var i=0; i<questions.length; i++) { %>' +
'    <div class="question" id="q-<%= i %>">' +
'      <div><%= questions[i].machineName %></div>' +
'    </div>' +
'  <% } %>' +
'  <div class="question-footer">' +
'    <div class="progress">' +
'      <% if (progressType == "dots") { %>' +
'        <% for (var i=0; i<questions.length; i++) { %>' +
'        <span class="progress-dot unanswered" id="qdot-<%= i %>">o</span>' +
'        <%} %>' +
'      <% } else if (progressType == "textual") { %>' +
'        <span class="progress-text"></span>' +
'      <% } %>' +
'    </div>' +
'    <button class="prev button"><%= texts.prevButton %></button>' +
'    <button class="next button"><%= texts.nextButton %></button>' +
'    <button class="finish button"><%= texts.finishButton %></button>' +
'  </div>' +
'</div>' +
  '';

  var defaults = {
    title: "",
    randomOrder: false,
    initialQuestion: 0,
    progressType: 'textual',
    questions: [],
    texts: {
      prevButton: "Previous",
      nextButton: "Next",
      finishButton: "Finish",
      textualProgress: "Question: @current of @total questions"
    }
  };

  var template = new EJS({text: texttemplate});
  var params = jQuery.extend({}, defaults, options);

  var currentQuestion = -1;
  var questionInstances = new Array();
  var allQuestionsAnswered = false;
  var myDom;

  if (params.randomOrder) {
    // TODO: Randomize order of questions
    console.log("TODO: Randomize order of questions");
  }

  var _showQuestion = function (questionNumber) {
    // Sanitize input.
    if (questionNumber < 0) { questionNumber = 0; }
    if (questionNumber >= params.questions.length) { questionNumber = params.questions.length - 1; }

    $('.prev.button', myDom).attr({'disabled': (questionNumber === 0)});
    $('.next.button', myDom).attr({'disabled': (questionNumber == params.questions.length-1)});

    // Hide all questions
    $('.question', myDom).hide();

    // Reshow the requested question
    $('#q-' + questionNumber, myDom).show();

    // Update progress indicator
    // Test if current has been answered.
    if (params.progressType == 'textual') {
      $('.progress-text', myDom).text(params.texts.textualProgress.replace("@current", questionNumber+1).replace("@total", params.questions.length));
      // $('.progress-current', myDom).text("" + (questionNumber+1));
    } else {
      $('.progress-dot.current', myDom).removeClass('current');
      // Set answered/unanswered for current.
      $('#qdot-' + questionNumber, myDom).addClass('current');
    }

    // Remember where we are
    currentQuestion = questionNumber;
    return currentQuestion;
  };

  // Function for attaching the multichoice to a DOM element.
  var attach = function (targetId) {
    // Render own DOM into target.
    template.update(targetId, params);
    myDom = jQuery('#' + targetId);

    // Attach questions
    for (var i=0; i<params.questions.length; i++) {
      var quest = params.questions[i];
      // TODO: Render on init, inject in template.
      var tmp = new (H5P.classFromName(quest.machineName))(quest.options).attach('q-' + i);
      questionInstances.push(tmp);
    }

    // Set event listeners.
    $('.next.button', myDom).click(function() {
      _showQuestion(currentQuestion + 1);
    });
    $('.prev.button', myDom).click(function() {
      _showQuestion(currentQuestion - 1);
    });

    // Hide all but initial Question.
    _showQuestion(params.initialQuestion);

    return this;
  };

  var getScore = function () {
    var score = 0;
    for (var i = questionInstances.length - 1; i >= 0; i--) {
      score += questionInstances[i].getScore();
    }
    return score;
  };

  return {
    attach: attach, // Attach to DOM object
    getQuestions: function () {return questionInstances;},
    getScore: getScore,
    defaults: defaults // Provide defaults for inspection
  };
};
