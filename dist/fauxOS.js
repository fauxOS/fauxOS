"use strict";function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor))throw new TypeError("Cannot call a class as a function")}function genUUID(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=16*Math.random()|0;return("x"==c?r:3&r|8).toString(16)})}function mkWorker(scriptStr){var blob=new Blob([scriptStr],{type:"application/javascript"}),uri=URL.createObjectURL(blob);return new Worker(uri)}function loadLocalFile(){var input=document.createElement("input");return input.type="file",input.click(),new Promise(function(resolve,reject){input.onchange=function(){resolve(input.files[0])}})}function readLocalFile(blob){var readAs=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"readAsText",reader=new FileReader;return reader[readAs](blob),new Promise(function(resolve,reject){reader.onloadend=function(){resolve(reader.result)}})}function openLocalFile(){return loadLocalFile().then(readLocalFile)}var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||!1,descriptor.configurable=!0,"value"in descriptor&&(descriptor.writable=!0),Object.defineProperty(target,descriptor.key,descriptor)}}return function(Constructor,protoProps,staticProps){return protoProps&&defineProperties(Constructor.prototype,protoProps),staticProps&&defineProperties(Constructor,staticProps),Constructor}}();window.faux={name:"faux",processTable:{},fileTable:{},sys:{}};var Pathname=function(){function Pathname(input){_classCallCheck(this,Pathname),this.input=input,this.clean=this.cleanf(),this.chop=this.chopf(),this.name=this.namef(),this.basename=this.basenamef(),this.parent=this.parentf(),this.extentions=this.extentionsf(),this.segment=this.segmentf()}return _createClass(Pathname,[{key:"cleanf",value:function(){var clean=[],pathArray=this.input.match(/[^\/]+/g);for(var i in pathArray){var name=pathArray[i];"."===name||(".."===name?clean.pop():clean.push(name))}return"/"+clean.join("/")}},{key:"chopf",value:function(){var segments=this.clean.match(/[^\/]+/g);return null===segments?["/"]:segments}},{key:"namef",value:function(){return this.chop[this.chop.length-1]}},{key:"basenamef",value:function(){var name=this.name;if(""===name)return name;var base=name.match(/^[^\.]+/);return null!==base?base[0]:""}},{key:"parentf",value:function(){if("/"===this.name)return null;var parentLen=this.clean.length-this.name.length;return this.clean.slice(0,parentLen)}},{key:"extentionsf",value:function(){return this.name.match(/\.[^\.]+/g)}},{key:"segmentf",value:function(){var pathArray=this.chop,segments=[];if("/"===this.name)segments=["/"];else for(var i=0;i<=pathArray.length;i++){var matchPath=pathArray.slice(0,i);segments.push("/"+matchPath.join("/"))}return segments}}]),Pathname}(),OFS_Inode=function OFS_Inode(){var config=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};_classCallCheck(this,OFS_Inode),this.links=0,Object.assign(this,config)},OFS=function(){function OFS(){_classCallCheck(this,OFS),this.drive=arguments[0]||[new OFS_Inode({links:1,id:0,type:"d",files:{".":0,"..":0}})]}return _createClass(OFS,[{key:"addInode",value:function(type){var name=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null,parentInode=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null;if(name.match("/"))return-1;var id=this.drive.length;return this.drive[id]=new OFS_Inode({links:1,type:type,id:id}),parentInode instanceof OFS_Inode&&"d"===parentInode.type&&(parentInode.files[name]=id),this.drive[id]}},{key:"mkFile",value:function(name,parentInode){var inode=this.addInode("f",name,parentInode);return inode<0?-1:(inode.data="",inode)}},{key:"mkDir",value:function(name,parentInode){var inode=this.addInode("d",name,parentInode);return inode<0?-1:(inode.files={".":inode.id,"..":parentInode.id},inode)}},{key:"mkLink",value:function(name,parentInode,targetInode){return name.match("/")?-1:(parentInode.files[name]=targetInode.id,targetInode)}},{key:"mkSymLink",value:function(name,parentInode,targetPath){var inode=this.addInode("sl",name,parentInode);if(inode<0)return-1;var path=new Pathname(targetPath).clean;return inode.redirect=path,inode}}]),OFS}(),VFS=function(){function VFS(){_classCallCheck(this,VFS),this.mounts={"/":arguments[0]||new OFS}}return _createClass(VFS,[{key:"mount",value:function(fs,mountPoint){return this.mounts[mountPoint]=fs}},{key:"unmount",value:function(mountPoint){return delete this.mounts[mountPoint]}},{key:"mountPoint",value:function(path){var pathname=new Pathname(path),segments=pathname.segment,mounts=Object.keys(this.mounts),resolves=[];for(var i in mounts){var mount=new Pathname(mounts[i]).clean;for(var _i in segments)segments[_i]===mount&&resolves.push(mount)}return resolves.pop()}},{key:"resolveHard",value:function(path){var inode=0,trace=[inode],pathname=new Pathname(path),mountPoint=this.mountPoint(pathname.clean),disk=this.mounts[mountPoint],diskLocalPath=pathname.clean.substring(mountPoint.length);if(""===diskLocalPath)return disk.inodes[inode];var pathArray=new Pathname(diskLocalPath).chop;for(var i in pathArray){var name=pathArray[i],inodeObj=disk.inodes[inode];if(void 0===inodeObj.files)return-1;if(void 0===(inode=inodeObj.files[name]))return-1;trace.push(inode)}return disk.inodes[trace.pop()]}},{key:"resolve",value:function(path){var redirectCount=arguments.length>1&&void 0!==arguments[1]?arguments[1]:0;if(redirectCount>=50)return-1;var inode=this.resolveHard(path);return inode<0?-1:"sl"===inode.type?(redirectCount++,this.resolve(inode.redirect,redirectCount)):inode}},{key:"rm",value:function(path){var pathname=new Pathname(path),parent=pathname.parent,parentInode=this.resolve(parent),name=pathname.name;return parentInode<0?-1:delete parentInode.files[name]}},{key:"mkPath",value:function(type,path){var target=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null,pathname=new Pathname(path),parent=pathname.parent,parentInode=this.resolve(parent),name=pathname.name,mountPoint=this.mountPoint(pathname.clean),disk=this.mounts[mountPoint];if(parentInode<0)return-1;var addedInode=-1;if("f"===type)addedInode=disk.mkFile(name,parentInode);else if("d"===type)addedInode=disk.mkDir(name,parentInode);else if("l"===type&&null!==target){var targetInode=this.resolve(target);if(targetInode<0)return-1;addedInode=disk.mkLink(name,parentInode,targetInode)}else{if("sl"!==type||null===target)return-1;addedInode=disk.mkSymLink(name,parentInode,target)}return addedInode<0?-1:addedInode}},{key:"touch",value:function(path){return this.mkPath("f",path)}},{key:"mkdir",value:function(path){return this.mkPath("d",path)}},{key:"ln",value:function(path,targetPath){return this.mkPath("l",path,targetPath)}},{key:"lns",value:function(path,targetPath){return this.mkPath("sl",path,targetPath)}}]),VFS}();faux.fs=new VFS(new OFS([new OFS_Inode({links:1,id:0,type:"d",files:{".":0,"..":0,bin:1,dev:2,etc:3,home:4,lib:5,log:6,mnt:7,tmp:8,usr:9}}),new OFS_Inode({links:1,type:"d",id:1,files:{".":1,"..":0}}),new OFS_Inode({links:1,type:"d",id:2,files:{".":2,"..":0}}),new OFS_Inode({links:1,type:"d",id:3,files:{".":3,"..":0}}),new OFS_Inode({links:1,type:"d",id:4,files:{".":4,"..":0}}),new OFS_Inode({links:1,type:"d",id:5,files:{".":5,"..":0,"lib.js":10}}),new OFS_Inode({links:1,type:"d",id:6,files:{".":6,"..":0}}),new OFS_Inode({links:1,type:"d",id:7,files:{".":7,"..":0}}),new OFS_Inode({links:1,type:"d",id:8,files:{".":8,"..":0}}),new OFS_Inode({links:1,type:"d",id:9,files:{".":9,"..":0}}),new OFS_Inode({links:1,type:"f",id:10,data:'/* lib.js */ "use strict";function newID(){for(var length=arguments.length>0&&void 0!==arguments[0]?arguments[0]:8,chars="0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz",id="",i=0;i<length;i++){var randNum=Math.floor(Math.random()*chars.length);id+=chars.substring(randNum,randNum+1)}return id}function sys(name,args){var id=newID();return postMessage({type:"syscall",name:name,args:args,id:id}),new Promise(function(resolve,reject){self.addEventListener("message",function(msg){msg.data.id===id&&("success"===msg.data.status?resolve(msg.data.result):reject(msg.data.reason))})})}function open(path){return sys("open",[path])} /* endinject */'})]));var FileDesc=function FileDesc(path){_classCallCheck(this,FileDesc),this.path=path,this.inode=faux.fs.resolve(this.path)},Process=function(){function Process(execImage){var _this=this;_classCallCheck(this,Process),this.fds=[],this.worker=mkWorker(execImage),this.worker.addEventListener("message",function(msg){_this.messageHandler(msg)})}return _createClass(Process,[{key:"messageHandler",value:function(msg){var obj=msg.data;if("syscall"===obj.type&&obj.name in faux.sys)void 0!==obj.id&&obj.args instanceof Array&&faux.sys[obj.name](this,obj.id,obj.args);else{var error={status:"error",reason:"Invalid request type and/or name",id:obj.id};this.worker.postMessage(error)}}},{key:"open",value:function(path){var fd=new FileDesc(path);return this.fds.push(fd),this.fds.length-1}},{key:"read",value:function(fdID){var fd=this.fds[fdID];return void 0!==fd.inode.data?fd.inode.data:-1}},{key:"write",value:function(fdID,data){var fd=this.fds[fdID];return void 0!==fd.inode.data?fd.inode.data=data:-1}}]),Process}();faux.sys.open=function(process,msgID,args){if(1!==args.length){var error={status:"error",reason:"Should have only 1 argument",id:msgID};process.worker.postMessage(error)}else if("string"!=typeof args[0]){var _error={status:"error",reason:"Argument should be a string",id:msgID};process.worker.postMessage(_error)}else{var result={status:"success",result:process.open(args[0]),id:msgID};process.worker.postMessage(result)}};