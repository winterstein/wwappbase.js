import DataStore from "./DataStore";
import ServerIO from "./ServerIOBase";

/**
 * Multi-user locking -- see LockServlet.java
 * 
 * E.g. use:
 * 
 * let pvLock = getLock(id);
	if (pvLock.value && pvLock.value.uid !== Login.getId()) {
		Messaging.notifyUser({id:"lock"+id, text:"Being edited by "+XId.id(pvLock.value.uid), type:"error"});
	}
 * 
    TODO refresh locks as people edit
    TODO support to break/take a lock

 * @param {!string} id 
 * @returns PV {uid}
 */
export const getLock = (id) => {
    let pvLock = DataStore.fetch(["misc","lock",id], () => {
        return ServerIO.load("https://calstat.good-loop.com/lock", {data: {id}});
    }, {cachePeriod: 60000});
    return pvLock;
}
