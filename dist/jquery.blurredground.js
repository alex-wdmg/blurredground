/*

BlurredGround 0.1-alpha
Real time blurred background from full-height page canvas by @wdmg
https://github.com/wdmg/blurredground

Author: Alexsander Vyshyvetskyy
Contact: alex.vyshnyvetskyy@gmail.com
License: https://github.com/wdmg/blurredground/blob/master/LICENSE.md
Copyright (c) 2016 Alexsander Vyshyvetskyy (W.D.M.Group, Ukraine)

Require: 
	https://github.com/jquery/jquery
	https://github.com/niklasvh/html2canvas
	https://github.com/Quasimondo/QuasimondoJS/blob/master/blur/StackBlur.js

*/

(function() {
	"use strict";
	var $, BlurredGround;
	$ = jQuery;
	
	BlurredGround = function(element, options) {
		var element, blurredCanvas, scrollOffset, canvasId;
		this.options = $.extend({
			localStorage: true,
			cacheTime: 86400,
			background: '#ffffff',
			blurring: true,
			blurringRadius: 64,
			offsetX: 0,
			offsetY: 0,
			opacity: 1,
			lighten: 0.5,
			logging: false,
		}, $.fn.blurredGround.defaults, options || {});
		this.element = element;
		this.$element = $(element);
		
		if (typeof html2canvas !== "function") {
			console.warn('"Html2canvas" plugin is not found or was not init first!');
			return;
		}
		
		if (typeof stackBlurImage !== "function") {
			console.warn('"StackBlur" plugin is not found or was not init first!');
			return;
		}
		
		return this.init();
	};
	
	BlurredGround.prototype = {
		getUrlHash: function(url) {
			return url.split("").reduce(function(a, b) {
				a = ((a << 5) - a) + b.charCodeAt(0);
				return a & a
			}, 0);
		},
		attachBackground: function(ocanvas) {
			this.blurredCanvas = ocanvas;
			this.$element.css('background', 'url(' + this.blurredCanvas + ') center top no-repeat');
			this.$element.show();
			if(this.options.logging)
				console.log('Attach background to element.');
		},
		bindScrolling: function() {
			$(window).scroll(function() {
				var position = -($(window).scrollTop());
				$('body > nav').css('background-position', 'center ' + position + 'px');
			});
		},
		getPageSizes: function() {
			var body = document.body
			var html = document.documentElement;
			var width = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
			var height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
			
			if(this.options.logging)
				console.log('Get full-page sizes, width: '+ width + 'px, height: '+ height);
			
			return {
				width: width,
				height: height
			};
		},
		lightenBg: function(canvas, opacity) {
			var ctx = canvas.getContext('2d');
			var idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
			var data = idata.data;
			var len = data.length;
			var r, g, b;
			for (var i = 0; i < len; i += 4) {
				r = data[i];
				g = data[i + 1];
				b = data[i + 2];
				data[i] = r + r * (r / 255) * opacity;
				data[i + 1] = g + g * (g / 255) * opacity;
				data[i + 2] = b + b * (b / 255) * opacity;
			}
			ctx.putImageData(idata, 0, 0);
		},
		toLocalStorage: function(canvas) {
			var object = {
				value: canvas,
				timestamp: new Date().getTime()
			}
			localStorage.setItem(this.canvasId, JSON.stringify(object));
		},
		generateBackground: function() {
			$('body').scrollTop(0);
			/*$('body img').each(function() {
				$(this).attr('src', getDataUri($(this).attr('src')));
			});*/
			var sizes = this.getPageSizes();
			
			if(this.options.logging)
				console.log('Generate full-page canvas (html2canvas)');
				
			var sizes = sizes;
			var timeStart = new Date().getTime();
			var blurredGround = this;
			html2canvas($('body'), {
				onrendered: function(canvas) {
					var _this = blurredGround;
					var _sizes = sizes;
					
					if(_this.options.logging)
						console.log('Create temporary canvas "#'+_this.canvasId+'".');
					
					var ocanvas = document.createElement('canvas');
					ocanvas.id = _this.canvasId;
					$('canvas#'+_this.canvasId).addClass('hide');
					document.body.appendChild(ocanvas);
					ocanvas.width = _sizes.width;
					ocanvas.height = _sizes.height;
					
					if(_this.options.logging)
						console.log('Set canvas offset x: "'+_this.options.offsetX+'", y: "'+_this.options.offsetY+'".');
					
					
					ocanvas.style.left = _this.options.offsetX + 'px';
					ocanvas.style.top = _this.options.offsetY + 'px';
					
					if(_this.options.opacity > 0) {
						if(_this.options.logging)
							console.log('Set opacity canvas with "'+_this.options.opacity+'" koef.');
						
						ocanvas.globalAlpha = _this.options.opacity;
					}
					
					var ctx = ocanvas.getContext('2d');
					ctx.drawImage(canvas, _this.options.offsetX, _this.options.offsetY, _sizes.width, _sizes.height, 0, 0, _sizes.width, _sizes.height);
					ctx.fillStyle = _this.options.background;
				
					if(_this.options.lighten > 0) {
						if(_this.options.logging)
							console.log('Process lighten canvas with "'+_this.options.lighten+'" koef.');
						
						_this.lightenBg(ocanvas, _this.options.lighten);
					}
					
					if(_this.options.blurring && _this.options.blurringRadius > 0) {
						if(_this.options.logging)
							console.log('Process blurring canvas with "'+_this.options.blurringRadius+'" blurring radius.');
						
						stackBlurCanvasRGBA(_this.canvasId, _this.options.offsetX, _this.options.offsetY, sizes.width, sizes.height, _this.options.blurringRadius);
					}
					
					_this.blurredCanvas = ocanvas.toDataURL('image/png');
					_this.attachBackground(_this.blurredCanvas);
					_this.toLocalStorage(_this.blurredCanvas);
					_this.bindScrolling();
					
					if(_this.options.logging)
						console.log('Remove temporary canvas "#'+_this.canvasId+'" from document.');
					
					$('canvas#'+_this.canvasId).remove();
					
					var timeNow = new Date().getTime();
					if(_this.options.logging)
						console.log('Generation complete, it took time: '+((timeNow - timeStart)/1000)+' sec.');
				},
				background: this.options.background,
				width: sizes.width,
				height: sizes.height
			});
			return;
		},
		init: function() {
			this.$element.css('background', this.options.background);
			var documentUrlHash = this.getUrlHash(document.location.href);
			
			if(this.options.logging)
				console.log('Current location href hash: '+documentUrlHash);
			
			if(this.options.localStorage && typeof(Storage) !== "undefined") {
				if(this.options.logging)
					console.log('Web local storage support!');
				
				this.canvasId = "ocanvas" + documentUrlHash;
				if(this.options.logging)
					console.log('Page canvas indefier in localStorage: '+this.canvasId);
				
				var object = JSON.parse(localStorage.getItem(this.canvasId));
				var timestamp, now = new Date().getTime();
				
				if (!$.isEmptyObject(object)) {
					timestamp = object.timestamp;
				} else {
					if(this.options.logging)
						console.log('Canvas timestamp "'+this.canvasId+'" is empty in localStorage.');
				}
				
				timestamp = parseInt(timestamp/1000);
				now = parseInt(now/1000);
				
				if(this.options.logging)
					console.log('Current time: "'+now+'", timestamp: "'+timestamp+'", cache time "'+this.options.cacheTime+'".');
				
				if (parseInt(now - timestamp) <= parseInt(this.options.cacheTime)) {
					if(this.options.logging)
						console.log('Get canvas object from localStorage and attach to background element.');

					this.attachBackground(object.value);
					this.bindScrolling();
					return;
				} else {
					if(this.options.logging)
						console.log('Generate new canvas background (cache is outdated).');
					
					this.generateBackground();
					return;
				}
				
			}
		}
	};
	
	$.fn.blurredGround = function(options) {
		return this.each(function() {
			var $this;
			$this = $(this);
			options = $.extend({
				localStorage: true,
				cacheTime: 86400,
				blurring: true,
				blurringRadius: 64,
				background: '#ffffff',
				offsetX: 0,
				offsetY: 0,
				opacity: 1,
				lighten: 0.5,
				logging: false,
			}, options, $this.data());
			new BlurredGround(this, options);
			return this;
		});
	};

	$.fn.blurredGround.defaults = {
		localStorage: true,
		cacheTime: 86400,
		blurring: true,
		blurringRadius: 64,
		background: '#ffffff',
		offsetX: 0,
		offsetY: 0,
		opacity: 1,
		lighten: 0.5,
		logging: false
	};

}).call(this);
