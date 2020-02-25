/*
* jQuery plugin that changes any element on your page
* 
* @author Big Tiger
* @website https://github.com/bigtiger1/JQuery/
* @license Dual licensed under the MIT or GPL Version 2 licenses
* @version 1.0
*/
(function($, window) {

    'use strict';

    var $win = $(window), // Reference to window

    // Reference to textarea
    $editElement = false,
    
    // Reference to currently edit element
    $currentlyEdited = false,

    // Reference to old value in case we cancel editing
    $oldElement = false,

    // Some constants
    EVENT_ATTR = 'data-edit-event',
    IS_EDITING_ATTR = 'data-is-editing',
    DBL_TAP_EVENT = 'dbltap',
    SUPPORTS_TOUCH = 'ontouchend' in window,
    TINYMCE_INSTALLED = 'tinyMCE' in window && typeof window.tinyMCE.init == 'function',

    // reference to old is function
    oldjQueryIs = $.fn.is,

    /*
     * Function responsible of triggering double tap event
     */
    lastTap = 0,
    tapper = function() {
        var now = new Date().getTime();
        if( (now-lastTap) < 250 ) {
            $(this).trigger(DBL_TAP_EVENT);
        }
        lastTap = now;
    },

    /**
     * Event listener that largens font size
     */
    keyHandler = function(e) {
        if( e.keyCode == 27 ) {
            resetElement($currentlyEdited, $oldElement.text());
        }
        else if( e.keyCode == 13 && e.data.closeOnEnter ) {
            $currentlyEdited.editable('close');
        }
        else if( e.data.toggleFontSize && (e.metaKey && (e.keyCode == 38 || e.keyCode == 40)) ) {
            var fontSize = parseInt($editElement.css('font-size'), 10);
            fontSize += e.keyCode == 40 ? -1 : 1;
            $editElement.css('font-size', fontSize+'px');
            return false;
        }
    },

    /**
     * Adjusts the height of the textarea to remove scroll
     * @todo This way of doing it does not make the textarea smaller when the number of text lines gets smaller
     */
    adjustTextAreaHeight = function() {
        if( $editElement[0].scrollHeight !== parseInt($editElement.attr('data-scroll'), 10) ) {
            $editElement.css('height', $editElement[0].scrollHeight +'px');
            $editElement.attr('data-scroll', $editElement[0].scrollHeight);
        }
    },

    /**
     * @param {jQuery} $el
     * @param {String} newText
     */
    resetElement = function($el, newText) {
        $el.removeAttr('data-is-editing');
        $el.html( newText );
        $editElement.remove();
    },


    /**
     * Function creating editor
     */
    elementEditor = function($el, opts) {

        if( $el.is(':editing') )
            return;

        $currentlyEdited = $el;
        $oldElement = $el.clone();
        $el.attr('data-is-editing', '1');

        var defaultText = $.trim( $el.html() ),
            defaultFontSize = $el.css('font-size'),
            elementHeight = $el.height() * 1.4,
            elementStyle = 'font-family: '+$el.css('font-family')+
                '; font-size: '+$el.css('font-size')+';'+
                'font-weight: '+$el.css('font-weight')+';';
                

        if( opts.lineBreaks ) {
            defaultText = defaultText.replace(/<br( |)(|\/)>/g, '\n');
        }

        switch (opts.type) {
            case 'text':
                $editElement = $('<input>', {type:'text'});
                break;
            case 'number':
                $editElement = $('<input>', {type:'number'});
                break;
            case 'date':
                $editElement = $('<input>', {type:'date'});
                break;
            default:
                $editElement = $('<textarea/>');
        } 

        $el.text('');

        // if( navigator.userAgent.match(/webkit/i) !== null ) {
        //     elementStyle = document.defaultView.getComputedStyle($el.get(0), "").cssText;
        // }

        /*
          TINYMCE EDITOR
         */
        if( opts.tinyMCE !== false ) {
            var id = 'editable-area-'+(new Date().getTime());
            $editElement
                .val(defaultText)
                .appendTo($el)
                .attr('id', id);

            if( typeof opts.tinyMCE != 'object' )
                opts.tinyMCE = {};

            opts.tinyMCE.mode = 'exact';
            opts.tinyMCE.elements = id;
            opts.tinyMCE.width = $el.innerWidth();
            opts.tinyMCE.height = $el.height() + 200;
            opts.tinyMCE.theme_advanced_resize_vertical = true;

            opts.tinyMCE.setup = function (ed) {
                ed.onInit.add(function(editor, evt) {
                    var editorWindow = editor.getWin();
                    var hasPressedKey = false;
                    var editorBlur = function() {

                        var newText = $(editor.getDoc()).find('body').html();
                        if( $(newText).get(0).nodeName == $el.get(0).nodeName ) {
                            newText = $(newText).html();
                        }

                        // Update element and remove editor
                        resetElement($el, newText);
                        editor.remove();
                        $editElement = false;
                        $win.off('click', editorBlur);
                        $currentlyEdited = false;

                        // Run callback
                        if( typeof opts.callback == 'function' ) {
                            opts.callback({
                                content : newText == defaultText || !hasPressedKey ? false : newText,
                                fontSize : false,
                                $el : $el
                            });
                        }
                    };

                    // Blur editor when user clicks outside the editor
                    setTimeout(function() {
                        $win.on('click', editorBlur);
                    }, 500);

                    // Create a dummy textarea that will called upon when
                    // programmatically interacting with the editor
                    $editElement = $('<textarea/>');
                    $editElement.on('blur', editorBlur);

                    editorWindow.onkeydown = function() {
                        hasPressedKey = true;
                    };

                    editorWindow.focus();
                });
            };

            tinyMCE.init(opts.tinyMCE);
        }

        /*
         TEXTAREA, DATE, NUMBER EDITOR
         */
        else {

            if( opts.toggleFontSize || opts.closeOnEnter ) {
                $win.on('keydown', opts, keyHandler);
            }
            if (opts.type === 'textarea'){
                $win.on('keyup', adjustTextAreaHeight);
            }

            $editElement
                .val(defaultText)
                .blur(function() {

                    $currentlyEdited = false;

                    // Get new text and font size
                    var newText = $.trim( $editElement.val() ),
                        newFontSize = $editElement.css('font-size');
                    if( opts.lineBreaks ) {
                        newText = newText.replace(new RegExp('\n','g'), '<br />');
                    }
                    if (!newText) {
                        resetElement($el, $oldElement.text());
                        return;
                    }
                    // Update element
                    resetElement($el, newText);
                    if( newFontSize != defaultFontSize ) {
                        $el.css('font-size', newFontSize);
                    }

                    // remove textarea and size toggles
                    $win.off('keydown', keyHandler);
                    $win.off('keyup', adjustTextAreaHeight);

                    // Run callback
                    if( typeof opts.callback == 'function' ) {
                        opts.callback({
                            content : newText == defaultText ? false : newText,
                            fontSize : newFontSize == defaultFontSize ? false : newFontSize,
                            $el : $el
                        });
                    }
                })
                .addClass(opts.cssClass)
                .attr('style', elementStyle)
                .appendTo($el)
                .css({
                    margin: 0,
                    padding: '2px',
                    height : elementHeight + 4 +'px',
                })
                .focus()
                .get(0).select();

            adjustTextAreaHeight();

        }

        $el.trigger('edit', [$editElement]);
    },

    /**
     * Event listener
     */
    editEvent = function(event) {
        if( $currentlyEdited !== false ) {
            // Not closing the currently open editor before opening a new
            // editor makes things go crazy
            $currentlyEdited.editable('close');
            var $this = $(this);
            elementEditor($this, event.data);
        }
        else {
            elementEditor($(this), event.data);            
        }
        return false;
    };

    /**
     * Jquery plugin that makes elments editable
     * @param {Object|String} [opts] Either callback function or the string 'destroy' if wanting to remove the editor event
     * @return {jQuery|Boolean}
     */
    $.fn.editable = function(opts) {

        if(typeof opts == 'string') {

            if( this.is(':editable') ) {

                switch (opts) {
                    case 'open':
                        if( !this.is(':editing') ) {
                            this.trigger(this.attr(EVENT_ATTR));
                        }
                        break;
                    case 'close':
                        if( this.is(':editing') ) {
                            $editElement.trigger('blur');
                        }
                        break;
                    case 'destroy':
                        if( this.is(':editing') ) {
                            $editElement.trigger('blur');
                        }
                        this.off(this.attr(EVENT_ATTR));
                        this.removeAttr(EVENT_ATTR);
                        break;
                    default:
                        console.warn('Unknown command "'+opts+'" for jquery.editable');
                }

            } else {
                console.error('Calling .editable() on an element that is not editable, call .editable() first');
            }
        }
        else {

            if( this.is(':editable') ) {
                console.warn('Making an already editable element editable, call .editable("destroy") first');
                this.editable('destroy');
            }

            opts = $.extend({
                event : 'dblclick',
                touch : true,
                lineBreaks : true,
                toggleFontSize : true,
                closeOnEnter : false,
                tinyMCE : false, 
                type : 'textarea',
                cssClass:'editable--editing'
            }, opts);

            if( opts.tinyMCE !== false && !TINYMCE_INSTALLED ) {
                console.warn('Trying to use tinyMCE as editor but id does not seem to be installed');
                opts.tinyMCE = false;
            }

            if( SUPPORTS_TOUCH && opts.touch ) {
                opts.event = DBL_TAP_EVENT;
                this.off('touchend', tapper);
                this.on('touchend', tapper);
            }
            else {
                opts.event += '.textEditor';
            }

            this.on(opts.event, opts, editEvent);
            this.attr(EVENT_ATTR, opts.event);            
        }

        return this;
    };

    /**
     * Add :editable :editing to $.is()
     * @param {Object} statement
     * @return {*}
     */
    $.fn.is = function(statement) {
        if( typeof statement == 'string' && statement.indexOf(':') === 0) {
            if( statement == ':editable' ) {
                return this.attr(EVENT_ATTR) !== undefined;
            } else if( statement == ':editing' ) {
                return this.attr(IS_EDITING_ATTR) !== undefined;
            }
        }
        return oldjQueryIs.apply(this, arguments);
    }

})(jQuery, window);
