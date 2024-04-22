import { Inter } from "next/font/google";
import { useCollectionsState } from "@/store/collections.store";
import { useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
	const { collections } = useCollectionsState();
	console.log({ collections });

	return (
		<div className='py-[30px] px-[40px]'>
			<h2 className='text-white text-[20px] font-semibold'>My Activity</h2>

			<p className='mt-2 text-[14px] font-medium text-[#AEB9E1]'>
				You have {collections.length} collection(s) to bid on
			</p>
		</div>
	);
}
