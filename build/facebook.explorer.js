(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module unless amdModuleId is set
    define(["bluebird","facebook","lodash"], function (a0,b1,c2) {
      return (factory(a0,b1,c2));
    });
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require("bluebird"),require("facebook"),require("lodash"));
  } else {
    root['FBExplorer'] = factory(root["bluebird"],root["facebook"],root["lodash"]);
  }
}(this, function (Promise, FB, _) {

"use strict";

var enums = {
    types: {
        EVENT: "event",
        PAGE: "page",
        PLACE: "place"
    },
    fields: {
        event: {
            "basic": [
                "id", "name"
            ],
            "brief": [
                "category", "cover", "description", "id", "end_time", "name", "place", "start_time"
            ],
            "extended": [
                "attending_count", "category", "cover", "description", "id", "interested_count", "end_time", "maybe_count", "name", "place", "start_time", "type"
            ],
            "full": [
                "attending_count", "can_guests_invite", "can_viewer_post", "category", "cover", "declined_count", "description", "end_time", "id", "interested_count", "is_cancelled", "is_draft", "is_page_owned", "is_viewer_admin", "maybe_count", "name", "noreply_count", "owner", "parent_group", "place", "start_time", "ticket_uri", "timezone", "type", "updated_time"
            ]
        },
        page: {
            "basic": [
                "id", "name"
            ],
            "brief": [
                "category", "cover", "description", "id", "location", "name"
            ],
            "extended": [
                "category", "contact_address", "cover", "description", "fan_count", "featured_video", "founded", "id", "location", "name", "talking_about_count", "website"
            ],
            "full": [
                "about", "app_links", "best_page", "can_checkin", "category", "category_list", "contact_address", "cover", "description", "display_subtext", "emails", "fan_count", "featured_video", "founded", "general_info", "id", "impressum", "is_community_page", "is_verified", "link", "location", "name", "overall_star_rating", "parent_page", "phone", "rating_count", "start_info", "supports_instant_articles", "talking_about_count", "website", "were_here_count"
            ]
        },
        place: {
            "basic": [
                "id", "name"
            ],
            "brief": [
                "category", "description", "id", "location", "name", "picture"
            ],
            "extended": [
                "category", "description", "hours", "id", "location", "name", "phone", "picture", "website"
            ],
            "full": [
                "about", "category", "category_list", "cover", "checkins", "description", "hours", "id", "is_always_open", "is_permanently_closed", "is_verified", "link", "location", "name", "overall_star_rating", "parking", "payment_options", "phone", "photos", "picture", "price_range", "rating_count", "restaurant_services", "restaurant_specialties", "single_line_address", "website", "workflows"
            ]
        }
    },
    profiles: {
        BASIC: "basic",
        BRIEF: "brief",
        EXTENDED: "extended",
        FULL: "full"
    },
    sort: {
        DISTANCE: "distance",
        NAME: "name",
        TIME: "time"
    },
    order: {
        ASC: "asc",
        DESC: "desc"
    }
};

var defaults = {
    version: "v2.9",
    profile: enums.profiles.BRIEF,
    since: "now",
    days: 30 
};

var __token;
var __appId;
var __isReady;

var FacebookExplorer = {
    
    init: function(config) {
        __appId = config.appId;
        this.config = Object.assign({}, defaults, config); 
        
        __isReady = new Promise(function(resolve, reject) {
            FB.Event.subscribe("auth.statusChange", function(response) {
                if (response.status == "connected") {
                    resolve(true);
                }
                else {
                    reject(false);
                }
            }.bind(this));
        });
        
        FB.init({
            appId : this.getAppId(),
            version: this.config.version
        });
        
        return this.getLoginStatus();
    },
    
    ready: function() {
        return __isReady;
    },
    
    getLoginStatus: function() {
        return new Promise(function(resolve, reject){
            FB.getLoginStatus(function(response) {
                if (response && response.authResponse && response.authResponse.accessToken) {
                    this.setToken(response.authResponse.accessToken);
                    resolve();
                }
                else {
                    reject();
                }
            }.bind(this), true);
        }.bind(this));
    },
    
    getToken: function() {
        return __token;
    },
    
    setToken: function(token) {
        __token = token;
    },
    
    getAppId: function() {
        return __appId;
    },
    
    setAppId: function(appId) {
        __appId = appId;
        this.init({ appId: appId });
    },
    
    findPlaces: function(options, partialResultCallback) {
        if (!options) return;
        
        return this.search(enums.types.PLACE, options, partialResultCallback)
        .bind(this)
        .then(function(result) {
            var result = this.sort(result, options.sort, options.order, options.center);
            return result;
        });
    },
    
    findPages: function(options, partialResultCallback) {
        if (!options) return;
        
        return this.search(enums.types.PAGE, options, partialResultCallback)
        .bind(this)
        .then(function(result) {
            var result = this.sort(result, options.sort, options.order, options.center);
            return result;
        });
    },
    
    findEvents: function(options, partialResultCallback) {
        if (!options) return;
        
        var untilDate = options.until || this.__getDefaultUntilTime();
        var sinceDate = options.since || this.__getDefaultSinceTime();
        
        return this.findPlaces({
            center: options.center,
            distance: options.distance,
            fields: "id,events.fields(id).since(" + sinceDate + ").until(" + untilDate + ").limit(1)"
        })
        .bind(this)
        .then(function(result) {
            var promises = [];
            var l = result.length;
            while (l--) {               
                if (!result[l].events) continue;
                
                var searchPromise = this.__searchEventsByPlaceId({
                    placeId: result[l].id,
                    until: untilDate,
                    since: sinceDate,
                    profile: options.profile,
                    fields: options.fields
                }, partialResultCallback);
                promises.push(searchPromise);
            }
            
            return Promise.all(promises);
        })
        .bind(this)
        .then(function(result) {
            partialResultCallback && partialResultCallback.apply(null, [[], false]);
            
            return this.sort(_.flatten(result), options.sort, options.order, options.center);
        });
    },
    
    search: function(type, options, partialResultCallback) {
        if (!options) return;
        
        var searchResults = [];
        
        return this.ready()
        .bind(this)
        .then(function() {
            var next = "";
            var finishPredicate = function() {
                return _.isUndefined(next);
            };
            var action = function() { 
                return new Promise(function(resolve, reject) {
                    var url = next ? next : "/search?type=" + type + this.__getSearchQuery(type, options);
                    FB.api(url, function(response) {
                        if (!response || response.error) {
                            reject(response.error);
                        }
                        else {
                            var newResults = _.xorBy(searchResults, response.data, "id");
                            
                            next = response.paging && response.paging.next;
                            searchResults = searchResults.concat(newResults);
                            if (typeof partialResultCallback === "function") {
                                partialResultCallback.apply(null, [newResults, _.isUndefined(next)]);
                            }
                            resolve(next);
                        }
                    }.bind(this))
                }.bind(this))
            }.bind(this);
            
            return this.__promiseWhile(finishPredicate, action, next)
            .bind(this)
            .then(function(result) {
                return searchResults;
            });
        });
    },
    
    sort: function(items, sort, order, center) {      
        if (sort === enums.sort.DISTANCE) {
            items = this.__sortByDistance(items, order, center);
        }
        else if (sort === enums.sort.TIME){ 
            items = this.__sortByTime(items, order);
        }
        else if (sort === enums.sort.NAME) {
            items = this.__sortByField(items, sort, order);
        }
        
        return items;
    },
    
    getFieldsFromProfile: function(type, profile) {
        if (!this.__isTypeValid(type)) return;
        
        profile = this.__isProfileValid(profile) ? profile : defaults.profile;        
        
        return enums.fields[type][profile].join(",");
    },
    
    __getSearchQuery: function(type, options) {
        var queryString = "";
        queryString += "&q=" + (options.keywords || "");
        queryString += "&fields=" + (options.fields || this.getFieldsFromProfile(type, options.profile));
        queryString += "&accessToken=" + this.getToken();
        
        if(type === enums.types.EVENT) {
            queryString += "&since=" + options.since;
            queryString += "&until=" + options.until;
        }
        if (options.center) {
            queryString += "&center=" + options.center.latitude + "," + options.center.longitude;
        }
        if (options.center) {
            queryString += "&distance=" + options.distance;
        }
        
        return queryString;
    },
    
    __sortByDistance: function(items, order, center) {
        return items.sort(function(a, b) {
            var pointA = a && (a.location || (a.place && a.place.location)),
                pointB = b && (b.location || (b.place && b.place.location));
            
            if (!pointA && !pointB) return 0;            
            if (!pointA) return -1;
            if (!pointB) return 1;
            
            var distanceA = this.__calculateDistance(center, pointA),
                distanceB = this.__calculateDistance(center, pointB);
                
            return order === enums.order.ASC ? distanceA - distanceB : distanceB - distanceA; 
        }.bind(this));
    },
    
    __calculateDistance: function(start, end) {
        if (!start || !end) return;
        
        var lat1 = start.latitude,
            lon1 =  start.longitude,
            lat2 = end.latitude,
            lon2 = end.longitude;
        
        var earthDiameterInKilometers = 12742;
        var rad = 0.017453292519943295;
        var res = 0.5 - Math.cos((lat2 - lat1) * rad)/2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * (1 - Math.cos((lon2 - lon1) * rad))/2;
        
        return earthDiameterInKilometers * Math.asin(Math.sqrt(res));
    },
    
    __sortByTime: function(items, order) {
        return items.sort(function(a, b) {
            var dateA = new Date(a.start_time),
                dateB = new Date(b.start_time);
                
            return order === enums.order.ASC ? dateA - dateB : dateB - dateA; 
        });
    },
    
    __sortByField: function(items, field, order) {
        return _.orderBy(items, [field], [order]);
    },
    
    __isProfileValid: function(profile) {
        return _.includes(enums.profiles, profile);
    },
    
    __isTypeValid: function(type) {
        return _.includes(enums.types, type);
    },
    
    __searchEventsByPlaceId: function(options, partialResultCallback) {
        if (!options || !options.placeId) return;
        
        var searchResults = [];
        
        return this.ready()
        .bind(this)
        .then(function() {
            var next = "";
            var finishPredicate = function() {
                return _.isUndefined(next);
            };
            var action = function() { 
                return new Promise(function(resolve, reject) {
                    var url = next ? next : "/" + options.placeId + "/events?" + this.__getSearchQuery(enums.types.EVENT, options);
                    FB.api(url, function(response) {
                        if (!response || response.error) {
                            reject(response.error);
                        }
                        else {
                            var newResults = _.xorBy(searchResults, response.data, "id");
                            
                            next = response.paging && response.paging.next;
                            searchResults = searchResults.concat(newResults);
                            if (typeof partialResultCallback === "function") {
                                partialResultCallback.apply(null, [newResults, true]);
                            }
                            resolve(next);
                        }
                    }.bind(this))
                }.bind(this))
            }.bind(this);
            
            return this.__promiseWhile(finishPredicate, action, next)
            .bind(this)
            .then(function(result) {
                return searchResults;
            });
        });
    },
    
    __getDefaultSinceTime: function() {
        return defaults.since;
    },
    
    __getDefaultUntilTime: function() {
        var date = new Date();
        date.setDate(date.getDate() + defaults.days);
        
        return date.getFullYear() + "-" + this.__pad(date.getMonth() + 1) + "-" + this.__pad(date.getDate());
    },
    
    __pad: function(value) {
        return value < 10 ? "0" + value : "" + value;
    },
    
    __promiseWhile: Promise.method(function(finishPredicate, action, lastResult) {
        if (finishPredicate()) return lastResult;
        
        return action().then(this.__promiseWhile.bind(this, finishPredicate, action));
    })
};

return {
    init: FacebookExplorer.init.bind(FacebookExplorer),
    getAppId: FacebookExplorer.getAppId.bind(FacebookExplorer),
    setAppId: FacebookExplorer.setAppId.bind(FacebookExplorer),
    findEvents: FacebookExplorer.findEvents.bind(FacebookExplorer),
    findPages: FacebookExplorer.findPages.bind(FacebookExplorer),
    findPlaces: FacebookExplorer.findPlaces.bind(FacebookExplorer)
};


}));
