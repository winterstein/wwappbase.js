/**
 * A convenient place for ad-hoc widget tests.
 * This is not a replacement for proper unit testing - but it is a lot better than debugging via repeated top-level testing.
 */
import React from 'react';
import DataStore from '../plumbing/DataStore';
import SimpleTable from './SimpleTable';


// 		WARNING:
// 		CODE HERE MAY BE DELETED WITHOUT NOTICE!

const TestPage = () => {

	let path = ['misc', 'TestPage'];
	let widget = DataStore.getValue(path) || {};	

	const data = [
		{name:"Winterstein"},
		{name:"Dan"},{name:"Becca"},
		{name:"Nicholson"},
		{name:"Ken"},{name:"Lizzie"}
	];
	const columns = ["name", "foo"];
	// const rowtree = new Tree();
	// let w = Tree.add(rowtree, data[0]);
	// Tree.add(w, data[1]); Tree.add(w, data[2]);
	// let n = Tree.add(rowtree, data[3]);
	// Tree.add(n, data[4]); Tree.add(n, data[5]);
	// console.log(rowtree);

	let pipes = makePipes();
	let grid = [];
	pipes.forEach(pipe => {
		pipe.xys.forEach(xy => {
			grid[xy[0]][xy[1]] = pipe.col;
		});
	});
	// 	for (Pipe pipe : pipes) {
	// 		for(IntXY xy : pipe.xys) {
	// 			let i = pipe.xys.indexOf(xy);
	// 			grid[xy.x][xy.y] = pipe.col +(i<10? 0 : "") + i;
	// 		}
	// 	}
	// 	for (let i = 0; i < grid.length; i++) {
	// 		Printer.out(grid[i]);
	// 	}
	// }

	return (
		<div className="TestPage">
			<h1>Scratch Test Page</h1>
			<p>This page is for ad-hoc test & debug of individual widgets. The page is accessible in all our projects as #test.</p>
			<p>Insert a test widget below</p>

			{JSON.stringify(grid)}
		</div>
	);

};


class Pipe {
	col;
	xys = [];
}

function makePipes() {
		let w = 8;
		let pipes = [];
		for(let i=0; i<w; i++) {
			let pipe = new Pipe();
			pipes.push(pipe);
			pipe.col = "red blue green yellow brown orange pink grey".split(" ")[i];
			for(let j=0; j<w; j++) {				
				pipe.xys.add([i, j]);
			}
		}
				
		for(let i=0; i<1000000; i++) {
			let pipe1 = getRandomMember(pipes);
			let pipe2 = getRandomMember(pipes);
			if (pipe1==pipe2) continue;
			let ai = getRandomChoice(0.5)? 0 : pipe1.xys.length - 1;
			let bi = getRandomChoice(0.5)? 0 : pipe2.xys.length - 1;
			let a0 = pipe1.xys.get(ai);
			let b0 = pipe2.xys.get(bi);
			if (isTouching(a0, b0)) {
				// move one end
				if (Utils.getRandomChoice(0.5)) {
					move(pipe1,ai,pipe2,bi);
				} else {
					move(pipe2,bi,pipe1,ai);
				}
			}
		}	
		return pipes;	
	}
	
	 function move(pipe1,  ai,  pipe2,  bi) {
		if (pipe1.xys.size() < 4) return;
		let s = pipe1.xys.get(ai);
		// avoid looping back:
		if (isLoopBack(s, pipe2, pipe2.xys.get(bi))) {
			return;
		} else {
			pipe1.xys.remove(s);
			if (bi==0) pipe2.xys.add(bi, s);
			else pipe2.xys.add(s);
		}
	}

	function isLoopBack(s, pipe2, b0) {
		for (let i = 0; i < pipe2.xys.length; i++) {
			let b = pipe2.xys[i];
			if (b===b0) continue;
			if (isTouching(s,b)) return true;
		}
		return false;
	}

	function isTouching(a0, b0) {
		return (Math.abs(a0.x - b0.x)==1 && a0.y==b0.y)
				|| (Math.abs(a0.y - b0.y)==1 && a0.x==b0.x);
	}


export default TestPage;
