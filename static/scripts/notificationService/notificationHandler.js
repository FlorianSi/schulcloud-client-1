import {courseDownloader} from './courseDownloader';

export const notificationHandler = {
    
    handle: function(registration, message){
        let promiseChain = [];
        if(message.data && message.data.tag){
            promiseChain.push(this.handleData(message.data));
        }
        if(message.notification){
            promiseChain.push(this.showNotification(registration, message.notification));
        }
        return Promise.all(promiseChain);
    },
    
    handleData: function(data){
        switch(data.tag){
            case 'course-data-updated':
                console.log('download course data...');
                if(courseDownloader.isReady() !== true){
                    courseDownloader.initialize({
                        cacheName: 'courses'
                    });
                }
                return courseDownloader.downloadCourse(data.courseId);
            default:
                console.log('unknown notification tag received', data.tag);
                return Promise.reject(`unknown data.tag ${data.tag}`);
        }
    },
    
    showNotification: function (registration, notification) {
        const notificationTitle = notification.title;
        const notificationOptions = {
            body: notification.body,
            icon: notification.img || '/images/cloud.png'
        };
        return registration.showNotification(notificationTitle, notificationOptions);
    },

};
