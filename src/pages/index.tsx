import { BidState, useBidStateStore } from "@/store/bid.store";
import { useCollectionsState } from "@/store/collections.store";
import { useSettingsState } from "@/store/settings.store";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function Home() {
	const {
		rateLimit,
		apiKey,
		fundingWif,
		tokenReceiveAddress,
		bidExpiration,
		defaultLoopTime,
		defaultCounterLoopTime,
	} = useSettingsState();
	const { bidStates, startAll, stopAll, startBid, stopBid } =
		useBidStateStore();
	const { collections } = useCollectionsState();

	const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
	const [data, setData] = useState<BidState[]>([]);

	const handleSelectAllBidsChange = (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setSelectedCollections(
			event.target.checked
				? bidStates.map((bidState) => bidState.collectionSymbol)
				: []
		);
	};

	const handleBidCheckboxChange = (collectionSymbol: string) => {
		const selectedIndex = selectedCollections.indexOf(collectionSymbol);
		let newSelectedCollections: string[] = [];

		if (selectedIndex === -1) {
			newSelectedCollections = [...selectedCollections, collectionSymbol];
		} else {
			newSelectedCollections = selectedCollections.filter(
				(symbol) => symbol !== collectionSymbol
			);
		}

		setSelectedCollections(newSelectedCollections);
	};

	useEffect(() => {
		if (bidStates.length > 0) {
			setData(bidStates);
		}
	}, [bidStates]);

	const combinedCollections = useMemo(() => {
		return collections.map((collection) => {
			const bidState = bidStates.find(
				(bid) => bid.collectionSymbol === collection.collectionSymbol
			);

			return {
				collectionSymbol: collection.collectionSymbol,
				minBid: collection.minBid,
				maxBid: collection.maxBid,
				minFloorBid: collection.minFloorBid,
				maxFloorBid: collection.maxFloorBid,
				outBidMargin: collection.outBidMargin,
				bidCount: collection.bidCount,
				fundingWalletWIF: collection.fundingWalletWIF || fundingWif,
				tokenReceiveAddress:
					collection.tokenReceiveAddress || tokenReceiveAddress,
				duration: collection.duration || bidExpiration,
				scheduledLoop: collection.scheduledLoop || defaultLoopTime,
				counterbidLoop: collection.counterbidLoop || defaultCounterLoopTime,
				running: bidState?.running || false,
			};
		});
	}, [
		collections,
		bidStates,
		fundingWif,
		tokenReceiveAddress,
		bidExpiration,
		defaultLoopTime,
		defaultCounterLoopTime,
	]);

	console.log({ combinedCollections });

	return (
		<div className='py-[30px] px-[40px]'>
			<h2 className='text-white text-[20px] font-semibold'>My Activity</h2>
			<p className='mt-2 text-[14px] font-medium text-[#AEB9E1]'>
				You have {collections.length} collection(s) to bid on
			</p>

			<div className='mt-6'>
				<div className='flex justify-end gap-2 mb-6'>
					<button
						className='bg-[#CB3CFF] w-[140px] text-white font-medium text-xs py-2 px-4 rounded'
						onClick={() => startAll(selectedCollections)}>
						Start
					</button>
					<button
						className='bg-red-500 w-[140px] text-white font-medium text-xs py-2 px-4 rounded'
						onClick={() => stopAll(selectedCollections)}>
						Stop
					</button>
				</div>
				<div className='relative overflow-x-auto shadow-md'>
					<table className='w-full text-sm text-left text-white border border-[#343B4F] rounded-lg'>
						<thead className='text-xs bg-[#0A1330]'>
							<tr>
								<th scope='col' className='p-4'>
									<div className='flex items-center'>
										<input
											id='checkbox-all-search'
											type='checkbox'
											className='w-4 h-4 text-[#CB3CFF] bg-gray-100 border-gray-300 rounded focus:ring-[#CB3CFF] dark:focus:ring-[#CB3CFF] dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
											checked={selectedCollections.length === bidStates.length}
											onChange={handleSelectAllBidsChange}
											style={{ accentColor: "#CB3CFF" }}
										/>
										<label htmlFor='checkbox-all-search' className='sr-only'>
											Select All
										</label>
									</div>
								</th>
								<th scope='col' className='px-6 py-5'>
									Collection Symbol
								</th>
								<th scope='col' className='px-6 py-5'>
									Min Bid <span className='text-[#998ca6]'>BTC</span>
								</th>
								<th scope='col' className='px-6 py-5'>
									Max Bid <span className='text-[#998ca6]'>BTC</span>
								</th>
								<th scope='col' className='px-6 py-5'>
									Min Floor Bid <span className='text-[#998ca6]'>%</span>
								</th>
								<th scope='col' className='px-6 py-5'>
									Max Floor Bid <span className='text-[#998ca6]'>%</span>
								</th>
								<th scope='col' className='px-6 py-5'>
									Outbid Margin <span className='text-[#998ca6]'>BTC</span>
								</th>
								<th scope='col' className='px-6 py-5'>
									Bid Count
								</th>
								<th scope='col' className='px-6 py-5'>
									Duration
								</th>
								<th scope='col' className='px-6 py-5'>
									Status
								</th>
								<th scope='col' className='px-6 py-5'>
									Action
								</th>
							</tr>
						</thead>

						<tbody>
							{combinedCollections.length > 0 ? (
								combinedCollections.map((bidState, index) => (
									<tr
										key={index}
										className={`${
											index % 2 === 0 ? "bg-[#0b1739]" : "bg-[#091330]"
										}`}>
										<td className='w-4 p-4'>
											<div className='flex items-center'>
												<input
													id={`checkbox-table-search-${index}`}
													type='checkbox'
													className='w-4 h-4 text-[#CB3CFF] bg-gray-100 border-gray-300 rounded focus:ring-[#CB3CFF] dark:focus:ring-[#CB3CFF] dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
													style={{ accentColor: "#CB3CFF" }}
													checked={selectedCollections.includes(
														bidState.collectionSymbol
													)}
													onChange={() =>
														handleBidCheckboxChange(bidState.collectionSymbol)
													}
												/>
												<label
													htmlFor={`checkbox-table-search-${index}`}
													className='sr-only'>
													Select Bid
												</label>
											</div>
										</td>
										<th
											scope='row'
											className='px-6 py-5 font-medium text-gray-900 whitespace-nowrap dark:text-white'>
											<Link
												href={{
													pathname: `/bids/${bidState.collectionSymbol}`,
													query: { data: JSON.stringify(bidState) },
												}}
												className='underline font-semibold'>
												{bidState.collectionSymbol}
											</Link>
										</th>
										<td className='px-6 py-5 text-center'>{bidState.minBid}</td>
										<td className='px-6 py-5 text-center'>{bidState.maxBid}</td>
										<td className='px-6 py-5 text-center'>
											{bidState.minFloorBid}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.maxFloorBid}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.outBidMargin}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.bidCount}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.duration}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.running ? (
												<div className='bg-green-500 w-4 h-4 rounded-full text-center ring ring-green-400 ring-opacity-50'></div>
											) : (
												<div className='bg-[#AEB9E1] w-4 h-4 rounded-full text-center'></div>
											)}
										</td>
										<td className='flex items-center px-6 py-5'>
											<button
												className={`font-medium ${
													bidState.running
														? "text-red-600 hover:underline"
														: "text-green-600 hover:underline"
												}`}
												onClick={() => {
													bidState.running ? stopBid(index) : startBid(index);
												}}>
												{bidState.running ? "Stop" : "Start"}
											</button>
										</td>
									</tr>
								))
							) : (
								<tr>
									<td>No data available</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
