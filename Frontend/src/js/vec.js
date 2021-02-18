class Vec
{
	make(x = 0, y)
	{
		if(typeof x == 'object')
		{
			y = x.y;
			x = x.x;
		}

		if(y === undefined)
		{
			y = x;
		}

		return {x, y};
	}

	constructor(x = 0, y)
	{
		const v = this.make(x, y);

		this.x = v.x;
		this.y = v.y;
	}
	
	add(x = 0, y)
	{
		const v = this.make(x, y);

		return new Vec(this.x + v.x, this.y + v.y);
	}
	
	sub(x = 0, y)
	{
		const v = this.make(x, y);

		return new Vec(this.x - v.x, this.y - v.y);
	}
	
	mul(x = 0, y)
	{
		const v = this.make(x, y);

		return new Vec(this.x * v.x, this.y * v.y);
	}
	
	div(x = 0, y)
	{
		const v = this.make(x, y);

		return new Vec(this.x / v.x, this.y / v.y);
	}
	
	clamp(x = 0, y )
	{
		const v = this.make(x, y);

		x = Math.max(v.x, Math.min(this.x, v.x));
		y = Math.max(v.y, Math.min(this.y, v.y));
		return new Vec(x, y);
	}
	
	length()
	{
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}
	
	normalize()
	{
		const l = this.length();
		if(l == 0) return new Vec(0, 0);
		else return this.div(l);
	}
	
	neg()
	{
		return new Vec(-this.x, -this.y);
	}

	toAngle()
	{
	    var angle = Math.atan2(this.y, this.x);
	    var degrees = 180*angle/Math.PI;
	    return (360+degrees)%360;
	}

	rotate(rot)
	{
	    const angle = this.toAngle();
	    const length = this.length();
	    return angleToVec(angle + rot).mul(length);
	}

	lerp(v, a)
	{
		return new Vec((1-a)*this.x+a*v.x, (1-a)*this.y+a*v.y);
	}
	
	clone()
	{
		return new Vec(this.x, this.y);
	}
}

function angleToVec(angle)
{
	const rad = angle*Math.PI/180;
	return new Vec(Math.cos(rad), Math.sin(rad));
}

Vec.fromAngle = angleToVec;

export default Vec;