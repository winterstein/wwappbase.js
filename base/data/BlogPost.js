/** Data model functions for the Advert data-type. */
import DataClass from './DataClass';

/**
 * NB: in shared base, cos Portal and ImpactHub use this
 * 
 * See Campaign.java
 */
class BlogPost extends DataClass {
	/** @type{String} */
	title;

	/** @type{String} */
	subtitle;

	/** @type{String} */
	content;

	/** @type{String} */
	thumbnail

	/** @type{String} */
	author

	/** @type{String} */
	authorTitle

	/** @type{String} */
	authorPic

	/** @type{String} */
	customCSS

	/**
	 * @param {BlogPost} base 
	 */
	constructor(base) {
		super();
		DataClass._init(this, base);
	}
}
DataClass.register(BlogPost, "BlogPost"); 

BlogPost.readTime = (blogPost) => {
	// Optimistic reading speed as many "words" will be syntax
	const avgWPM = 300;
	let readTime = blogPost.content ? Math.round(blogPost.content.split(" ").length / avgWPM) : 1;
	if (readTime < 1) readTime = 1;
	return readTime;
}

export default BlogPost;