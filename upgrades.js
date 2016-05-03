var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.QuestionSet'] = (function ($) {
  return {
    1: {
      3: function (parameters, finished) {
        for (var i = 0; i < parameters.questions.length; i++) {
          if (parameters.questions[i].subContentId === undefined) {
            // NOTE: We avoid using H5P.createUUID since this is an upgrade script and H5P function may change in the
            // future
            parameters.questions[i].subContentId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(char) {
              var random = Math.random()*16|0, newChar = char === 'x' ? random : (random&0x3|0x8);
              return newChar.toString(16);
            });
          }
        }
        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support IV 1.7.
       *
       * Groups all UI text strings to make them eaiser to translate and handle.
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      8: function (parameters, finished) {

        if (parameters.override) {
          if (parameters.override.overrideButtons) {
            // Set new variables
            parameters.override.showSolutionButton =
                (parameters.override.overrideShowSolutionButton ? 'on' : 'off');
            parameters.override.retryButton =
                (parameters.override.overrideRetry ? 'on' : 'off');
          }

          // Remove old field variables
          delete parameters.override.overrideButtons;
          delete parameters.override.overrideShowSolutionButton;
          delete parameters.override.overrideRetry;
        }

        // Move copyright dialog question label
        if (parameters.questionLabel) {
          parameters.texts = parameters.texts || {};
          parameters.texts.questionLabel = parameters.questionLabel;
        }

        // Remove old copyright dialog question label
        delete parameters.questionLabel;

        finished(null, parameters);
      }
    }
  };
})(H5P.jQuery);
